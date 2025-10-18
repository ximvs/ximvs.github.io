// Enhanced Custom Authentication System with Error Handling
const supabaseUrl = 'https://qagijkefhdarqjclnnwe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZ2lqa2VmaGRhcnFqY2xubndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDk1NjQsImV4cCI6MjA3NjE4NTU2NH0.wVnCLmgPPBL-okPAeUfMzNoWA3v2eBqT5SOPdu629_E';

// Initialize Supabase
window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Password hashing
window.hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

window.customAuth = {
  setUser: (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
  },
  
  getUser: () => {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  },
  
  logout: () => {
    localStorage.removeItem('currentUser');
  },
  
  isLoggedIn: () => {
    return !!localStorage.getItem('currentUser');
  },
  
  login: async (username, password) => {
    try {
      const hashedPassword = await window.hashPassword(password);
      
      console.log('Attempting login for:', username);
      
      const { data, error } = await window.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', hashedPassword)
        .single();
      
      if (error) {
        console.error('Login error:', error);
        throw new Error('Invalid username or password');
      }
      
      if (!data) {
        throw new Error('Invalid username or password');
      }
      
      if (data.role === 'pending') {
        throw new Error('Your account is pending admin approval');
      }
      
      window.customAuth.setUser(data);
      return { user: data, error: null };
    } catch (error) {
      console.error('Login failed:', error);
      return { user: null, error };
    }
  },
  
  signup: async (email, password, username) => {
    try {
      const hashedPassword = await window.hashPassword(password);
      
      console.log('Attempting signup:', { email, username });
      
      // Check if username or email already exists
      const { data: existingUsers, error: checkError } = await window.supabase
        .from('users')
        .select('username, email')
        .or(`username.eq.${username},email.eq.${email}`);
      
      if (checkError) {
        console.error('Check existing users error:', checkError);
      }
      
      if (existingUsers && existingUsers.length > 0) {
        const existingUser = existingUsers[0];
        if (existingUser.username === username) {
          throw new Error('Username already registered');
        }
        if (existingUser.email === email) {
          throw new Error('Email already registered');
        }
      }
      
      // Insert new user
      const { data, error } = await window.supabase
        .from('users')
        .insert([
          { 
            email: email, 
            password: hashedPassword, 
            username: username,
            role: 'pending',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error('Signup insert error:', error);
        
        // Handle specific Supabase errors
        if (error.code === '42501') {
          throw new Error('Database permission denied. Please check RLS policies.');
        } else if (error.code === '23505') {
          throw new Error('Username or email already exists');
        } else {
          throw new Error('Registration failed: ' + error.message);
        }
      }
      
      console.log('Signup successful:', data);
      return { user: data, error: null };
    } catch (error) {
      console.error('Signup failed:', error);
      return { user: null, error };
    }
  },
  
  updateProfile: async (userId, updates) => {
    try {
      if (updates.password) {
        updates.password = await window.hashPassword(updates.password);
      }
      
      const { data, error } = await window.supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      if (data) {
        window.customAuth.setUser(data);
      }
      
      return { user: data, error: null };
    } catch (error) {
      return { user: null, error };
    }
  }
};

// Database wrapper
window.db = {
  collection: (name) => ({
    doc: (id) => ({
      get: async () => {
        try {
          const { data, error } = await window.supabase
            .from(name)
            .select('*')
            .eq('id', id)
            .single();
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching document:', error);
            throw error;
          }
          
          return { 
            exists: !!data && data !== null, 
            data: () => data 
          };
        } catch (error) {
          console.error('Database get error:', error);
          throw error;
        }
      },
      set: async (data) => {
        try {
          const { data: existingData, error: checkError } = await window.supabase
            .from(name)
            .select('id')
            .eq('id', id)
            .single();
          
          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
          }
          
          if (existingData) {
            const { error } = await window.supabase
              .from(name)
              .update(data)
              .eq('id', id);
            if (error) throw error;
          } else {
            const { error } = await window.supabase
              .from(name)
              .insert({ id: id, ...data });
            if (error) throw error;
          }
          
          return { success: true };
        } catch (error) {
          console.error('Database set error:', error);
          throw error;
        }
      }
    })
  })
};

window.getUserRole = () => {
  const user = window.customAuth.getUser();
  return user ? user.role : 'guest';
};

window.isAdmin = () => {
  const user = window.customAuth.getUser();
  return user && user.role === 'admin';
};

// Test database connection on load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data, error } = await window.supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Database connection test failed:', error);
    } else {
      console.log('Database connection successful');
    }
  } catch (error) {
    console.error('Database test error:', error);
  }
});