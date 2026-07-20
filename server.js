const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const prisma = new PrismaClient();
const app = express();
const JWT_SECRET = 'super-secret-key-for-mini-app';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword }
    });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(400).json({ error: 'User not found' });
  
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
  
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ token, userId: user.id, username: user.username });
});

app.get('/api/users/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      posts: { include: { author: true, likes: true, comments: true }, orderBy: { createdAt: 'desc' } },
      followers: { include: { follower: true } },
      following: { include: { following: true } }
    }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// --- POSTS ROUTES ---
app.get('/api/posts', async (req, res) => {
  const posts = await prisma.post.findMany({
    include: {
      author: { select: { id: true, username: true } },
      likes: true,
      comments: { include: { author: { select: { id: true, username: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(posts);
});

app.post('/api/posts', authenticateToken, async (req, res) => {
  const { content } = req.body;
  try {
    const post = await prisma.post.create({
      data: {
        content,
        authorId: req.user.id
      }
    });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Error creating post' });
  }
});

// --- INTERACTIONS (COMMENTS, LIKES, FOLLOWS) ---
app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  const { content } = req.body;
  try {
    const comment = await prisma.comment.create({
      data: {
        content,
        postId: parseInt(req.params.id),
        authorId: req.user.id
      }
    });
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: 'Error adding comment' });
  }
});

app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;
  
  try {
    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } }
    });
    
    if (existingLike) {
      // Unlike
      await prisma.like.delete({ where: { userId_postId: { userId, postId } } });
      res.json({ message: 'Unliked' });
    } else {
      // Like
      await prisma.like.create({ data: { userId, postId } });
      res.json({ message: 'Liked' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error toggling like' });
  }
});

app.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
  const followingId = parseInt(req.params.id);
  const followerId = req.user.id;
  
  if (followingId === followerId) return res.status(400).json({ error: 'Cannot follow yourself' });
  
  try {
    const existingFollow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } }
    });
    
    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({ where: { followerId_followingId: { followerId, followingId } } });
      res.json({ message: 'Unfollowed' });
    } else {
      // Follow
      await prisma.follow.create({ data: { followerId, followingId } });
      res.json({ message: 'Followed' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error toggling follow' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
