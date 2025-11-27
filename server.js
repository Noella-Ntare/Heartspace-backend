require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Cloudinary config (add your credentials)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = user.id;
    next();
  });
};

// ========== AUTH ROUTES ==========

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    // Generate token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get Current User
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// ========== ARTWORK ROUTES ==========

// Upload Artwork
app.post('/api/artworks', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'heartspace'
    });

    // Create artwork in database
    const artwork = await prisma.artwork.create({
      data: {
        title,
        description,
        imageUrl: result.secure_url,
        userId: req.userId
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json(artwork);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get All Artworks
app.get('/api/artworks', async (req, res) => {
  try {
    const artworks = await prisma.artwork.findMany({
      include: {
        user: {
          select: { id: true, name: true }
        },
        likes: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(artworks);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get Single Artwork
app.get('/api/artworks/:id', async (req, res) => {
  try {
    const artwork = await prisma.artwork.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: {
          select: { id: true, name: true }
        },
        likes: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!artwork) {
      return res.status(404).json({ error: 'Artwork not found' });
    }

    res.json(artwork);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Like Artwork
app.post('/api/artworks/:id/like', authenticateToken, async (req, res) => {
  try {
    const artworkId = parseInt(req.params.id);

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_artworkId: {
          userId: req.userId,
          artworkId: artworkId
        }
      }
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id }
      });
      res.json({ message: 'Unliked', liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId: req.userId,
          artworkId: artworkId
        }
      });
      res.json({ message: 'Liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Comment on Artwork
app.post('/api/artworks/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const artworkId = parseInt(req.params.id);

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId: req.userId,
        artworkId: artworkId
      },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// DELETE an artwork
app.delete('/api/artworks/:id', authenticateToken, async (req, res) => {
  try {
    const artworkId = parseInt(req.params.id);
    const userId = req.userId;
    
    // Check if artwork exists and belongs to user
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId }
    });
    
    if (!artwork) {
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    if (artwork.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own artworks' });
    }
    
    // Delete associated likes and comments first
    await prisma.like.deleteMany({
      where: { artworkId: artworkId }
    });
    
    await prisma.comment.deleteMany({
      where: { artworkId: artworkId }
    });
    
    // Delete the artwork
    await prisma.artwork.delete({
      where: { id: artworkId }
    });
    
    res.json({ message: 'Artwork deleted successfully' });
  } catch (error) {
    console.error('Error deleting artwork:', error);
    res.status(500).json({ error: 'Failed to delete artwork' });
  }
});

// ========== COMMUNITY POSTS ROUTES ==========

// Create Community Post
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const post = await prisma.post.create({
      data: {
        content,
        userId: req.userId
      },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get All Community Posts
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// DELETE a post
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.userId;
    
    // Check if post exists and belongs to user
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (post.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    
    // Delete the post
    await prisma.post.delete({
      where: { id: postId }
    });
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ========== LEARNING MODULE ROUTES ==========

// Get All Modules
app.get('/api/modules', async (req, res) => {
  try {
    const modules = await prisma.module.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(modules);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Get User Progress
app.get('/api/progress', authenticateToken, async (req, res) => {
  try {
    const progress = await prisma.progress.findMany({
      where: { userId: req.userId },
      include: {
        module: true
      }
    });
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Update Progress
app.post('/api/progress', authenticateToken, async (req, res) => {
  try {
    const { moduleId, completed } = req.body;

    const progress = await prisma.progress.upsert({
      where: {
        userId_moduleId: {
          userId: req.userId,
          moduleId: parseInt(moduleId)
        }
      },
      update: { completed },
      create: {
        userId: req.userId,
        moduleId: parseInt(moduleId),
        completed
      }
    });

    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ========== SESSION ROUTES ==========

// Create a session
app.post('/api/sessions', authenticateToken, async (req, res) => {
  console.log("=== CREATE SESSION ENDPOINT HIT ===");
  console.log("Request body:", req.body);
  console.log("User ID from token:", req.userId);
  
  try {
    const { title, date, time, maxAttendees } = req.body;
    const userId = req.userId;
    
    console.log("Creating session with:", { title, date, time, maxAttendees, userId });
    
    const session = await prisma.session.create({
      data: {
        title,
        date: new Date(date),
        time,
        maxAttendees: parseInt(maxAttendees),
        userId,
        attendees: {
          create: [{ userId }]
        }
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        attendees: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      }
    });
    
    console.log("✅ Session created successfully:", session);
    res.json(session);
  } catch (error) {
    console.error("❌ Error creating session:", error);
    res.status(500).json({ error: 'Failed to create session: ' + error.message });
  }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        attendees: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Join a session
app.post('/api/sessions/:id/join', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const userId = req.userId;
    
    // Check if session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { attendees: true }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if already joined
    const alreadyJoined = session.attendees.some(a => a.userId === userId);
    if (alreadyJoined) {
      return res.status(400).json({ error: 'Already joined this session' });
    }
    
    // Check if session is full
    if (session.attendees.length >= session.maxAttendees) {
      return res.status(400).json({ error: 'Session is full' });
    }
    
    // Join session
    await prisma.sessionAttendee.create({
      data: { sessionId, userId }
    });
    
    // Return updated session
    const updatedSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        attendees: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      }
    });
    
    res.json(updatedSession);
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// Leave a session
app.post('/api/sessions/:id/leave', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const userId = req.userId;
    
    // Check if user is the creator
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });
    
    if (session.userId === userId) {
      return res.status(400).json({ error: 'Cannot leave a session you created' });
    }
    
    // Leave session
    await prisma.sessionAttendee.deleteMany({
      where: { sessionId, userId }
    });
    
    // Return updated session
    const updatedSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        attendees: {
          include: {
            user: { select: { id: true, name: true } }
          }
        }
      }
    });
    
    res.json(updatedSession);
  } catch (error) {
    console.error('Error leaving session:', error);
    res.status(500).json({ error: 'Failed to leave session' });
  }
});

// Delete a session
app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const userId = req.userId;
    
    // Check if user is the creator
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own sessions' });
    }
    
    // Delete attendees first
    await prisma.sessionAttendee.deleteMany({
      where: { sessionId }
    });
    
    // Delete session
    await prisma.session.delete({
      where: { id: sessionId }
    });
    
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});