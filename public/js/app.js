const API_URL = 'http://localhost:3001/api';

// --- STATE MANAGEMENT ---
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let currentToken = localStorage.getItem('token') || null;

// --- DOM ELEMENTS ---
const authSection = document.getElementById('auth-section');
const mainApp = document.getElementById('main-app');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const logoutBtn = document.getElementById('logout-btn');
const feedSection = document.getElementById('feed');
const createPostBtn = document.getElementById('create-post-btn');
const postContentInput = document.getElementById('post-content');
const navProfile = document.getElementById('nav-profile');
const navProfileSelf = document.getElementById('nav-profile-self');

let isLogin = true;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  if (currentToken) {
    if (authSection) authSection.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    if (navProfile) navProfile.href = `profile.html?id=${currentUser.userId}`;
    if (navProfileSelf) navProfileSelf.href = `profile.html?id=${currentUser.userId}`;
    
    if (window.location.pathname.includes('profile.html')) {
      loadProfile();
    } else {
      loadFeed();
    }
  } else {
    if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
      window.location.href = 'index.html';
    }
  }
});

// --- AUTHENTICATION ---
if (tabLogin && tabRegister) {
  tabLogin.addEventListener('click', () => { isLogin = true; tabLogin.classList.add('active'); tabRegister.classList.remove('active'); document.getElementById('auth-submit').textContent = 'Login'; });
  tabRegister.addEventListener('click', () => { isLogin = false; tabRegister.classList.add('active'); tabLogin.classList.remove('active'); document.getElementById('auth-submit').textContent = 'Register'; });
}

if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ userId: data.userId, username: data.username }));
      window.location.href = 'index.html';
    } catch (err) {
      authError.textContent = err.message;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });
}

// --- FEED & POSTS ---
async function loadFeed() {
  if (!feedSection) return;
  try {
    const res = await fetch(`${API_URL}/posts`);
    const posts = await res.json();
    renderPosts(posts, feedSection);
  } catch (err) {
    console.error('Error loading feed', err);
  }
}

if (createPostBtn) {
  createPostBtn.addEventListener('click', async () => {
    const content = postContentInput.value;
    if (!content) return;
    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        postContentInput.value = '';
        loadFeed();
      }
    } catch (err) {
      console.error('Error creating post', err);
    }
  });
}

// --- RENDERING ---
function renderPosts(posts, container) {
  container.innerHTML = '';
  posts.forEach(post => {
    const isLiked = post.likes.some(l => l.userId === currentUser.userId);
    
    const postEl = document.createElement('div');
    postEl.className = 'post';
    postEl.innerHTML = `
      <div class="post-header">
        <div class="avatar-placeholder" style="width:40px;height:40px"></div>
        <div>
          <a href="profile.html?id=${post.author.id}" class="post-author">${post.author.username}</a>
          <div class="post-date">${new Date(post.createdAt).toLocaleString()}</div>
        </div>
      </div>
      <div class="post-content">${post.content}</div>
      <div class="post-actions">
        <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${post.id}">
          <span>👍</span> ${post.likes.length} Likes
        </button>
      </div>
      <div class="comments-section">
        <div class="comments-list">
          ${post.comments.map(c => `
            <div class="comment">
              <a href="profile.html?id=${c.author.id}" class="comment-author">${c.author.username}</a>
              ${c.content}
            </div>
          `).join('')}
        </div>
        <div class="add-comment">
          <input type="text" placeholder="Write a comment..." class="comment-input" data-id="${post.id}">
          <button class="comment-btn" data-id="${post.id}">Reply</button>
        </div>
      </div>
    `;
    container.appendChild(postEl);
  });
  
  // Attach event listeners for likes and comments
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => toggleLike(e.currentTarget.dataset.id));
  });
  
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const postId = e.currentTarget.dataset.id;
      const input = document.querySelector(`.comment-input[data-id="${postId}"]`);
      addComment(postId, input.value);
    });
  });
}

async function toggleLike(postId) {
  try {
    await fetch(`${API_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    // Reload whatever is on screen
    if (window.location.pathname.includes('profile.html')) loadProfile();
    else loadFeed();
  } catch (err) {
    console.error('Error liking post', err);
  }
}

async function addComment(postId, content) {
  if (!content) return;
  try {
    await fetch(`${API_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ content })
    });
    if (window.location.pathname.includes('profile.html')) loadProfile();
    else loadFeed();
  } catch (err) {
    console.error('Error adding comment', err);
  }
}

// --- PROFILE LOGIC ---
async function loadProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const profileId = urlParams.get('id');
  if (!profileId) return;
  
  try {
    const res = await fetch(`${API_URL}/users/${profileId}`);
    const user = await res.json();
    
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('followers-count').textContent = `${user.followers.length} Followers`;
    document.getElementById('following-count').textContent = `${user.following.length} Following`;
    
    const followBtn = document.getElementById('follow-btn');
    if (parseInt(profileId) !== currentUser.userId) {
      followBtn.classList.remove('hidden');
      const isFollowing = user.followers.some(f => f.followerId === currentUser.userId);
      followBtn.textContent = isFollowing ? 'Unfollow' : 'Follow';
      followBtn.onclick = () => toggleFollow(profileId);
    } else {
      followBtn.classList.add('hidden');
    }
    
    renderPosts(user.posts, document.getElementById('profile-posts'));
  } catch (err) {
    console.error('Error loading profile', err);
  }
}

async function toggleFollow(profileId) {
  try {
    await fetch(`${API_URL}/users/${profileId}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    loadProfile();
  } catch (err) {
    console.error('Error following user', err);
  }
}
