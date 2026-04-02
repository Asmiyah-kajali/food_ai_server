require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;
const dataDir = path.join(__dirname, 'data');

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB || 'foodApp';
const useMongo = Boolean(mongoUri);

let dbClient;
let db;
let usersCollection;
let menuCollection;
let ordersCollection;

app.use(cors());
app.use(express.json());

function readJson(filename) {
  const filePath = path.join(dataDir, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Could not read ${filename}:`, error.message);
    return null;
  }
}

function writeJson(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function connectMongo() {
  if (!useMongo) {
    console.log('MongoDB not configured, using JSON files for storage.');
    return;
  }

  try {
    dbClient = new MongoClient(mongoUri);
    await dbClient.connect();
    db = dbClient.db(mongoDbName);
    usersCollection = db.collection('users');
    menuCollection = db.collection('menu');
    ordersCollection = db.collection('orders');

    console.log(`Connected to MongoDB: ${mongoUri}`);
    await seedMongoData();
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function seedMongoData() {
  const menuCount = await menuCollection.countDocuments();
  if (menuCount === 0) {
    const menuData = readJson('menu.json');
    if (menuData) {
      await menuCollection.insertOne(menuData);
      console.log('Seeded menu collection from data/menu.json');
    }
  }

  const userCount = await usersCollection.countDocuments();
  if (userCount === 0) {
    const usersData = readJson('users.json');
    if (usersData && Array.isArray(usersData.users) && usersData.users.length > 0) {
      await usersCollection.insertMany(usersData.users);
      console.log('Seeded users collection from data/users.json');
    }
  }

  const orderCount = await ordersCollection.countDocuments();
  if (orderCount === 0) {
    const ordersData = readJson('orders.json');
    if (ordersData && Array.isArray(ordersData.orders) && ordersData.orders.length > 0) {
      await ordersCollection.insertMany(ordersData.orders);
      console.log('Seeded orders collection from data/orders.json');
    }
  }
}

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Food backend is running' });
});

app.get('/api/menu', async (req, res) => {
  try {
    if (useMongo) {
      const menu = await menuCollection.findOne({});
      if (!menu) {
        return res.status(500).json({ error: 'Unable to read menu data' });
      }
      return res.json(menu);
    }

    const menu = readJson('menu.json');
    if (!menu) {
      return res.status(500).json({ error: 'Unable to read menu data' });
    }
    res.json(menu);
  } catch (error) {
    console.error('Menu fetch failed:', error);
    res.status(500).json({ error: 'Unable to read menu data' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing username, email or password' });
  }

  try {
    let usersData;
    if (useMongo) {
      usersData = { users: await usersCollection.find().toArray() };
    } else {
      usersData = readJson('users.json');
      if (!usersData) {
        return res.status(500).json({ error: 'Unable to read users data' });
      }
    }

    const userExists = usersData.users.some(
      u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase()
    );
    if (userExists) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password
    };

    if (useMongo) {
      await usersCollection.insertOne(newUser);
    } else {
      usersData.users.push(newUser);
      writeJson('users.json', usersData);
    }

    res.status(201).json({ message: 'Signup successful', user: { username, email } });
  } catch (error) {
    console.error('Signup failed:', error);
    res.status(500).json({ error: 'Unable to save user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    let usersData;
    if (useMongo) {
      usersData = { users: await usersCollection.find().toArray() };
    } else {
      usersData = readJson('users.json');
      if (!usersData) {
        return res.status(500).json({ error: 'Unable to read users data' });
      }
    }

    const user = usersData.users.find(
      u => (u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()) && u.password === password
    );
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({ message: 'Login successful', user: { username: user.username, email: user.email } });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Unable to read users data' });
  }
});

app.post('/api/orders', async (req, res) => {
  const { username, address, paymentMethod, items } = req.body;
  if (!username || !address || !paymentMethod || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing order data' });
  }

  const newOrder = {
    id: `order_${Date.now()}`,
    username,
    address,
    paymentMethod,
    items,
    createdAt: new Date().toISOString(),
    status: 'received'
  };

  try {
    if (useMongo) {
      await ordersCollection.insertOne(newOrder);
    } else {
      const orderData = readJson('orders.json');
      if (!orderData) {
        return res.status(500).json({ error: 'Unable to read orders data' });
      }
      orderData.orders.push(newOrder);
      writeJson('orders.json', orderData);
    }

    res.status(201).json({ message: 'Order placed successfully', order: newOrder });
  } catch (error) {
    console.error('Order save failed:', error);
    res.status(500).json({ error: 'Unable to save order' });
  }
});

app.get('/api/orders/:username', async (req, res) => {
  const username = req.params.username;
  try {
    let orders;
    if (useMongo) {
      orders = await ordersCollection.find().toArray();
    } else {
      const orderData = readJson('orders.json');
      if (!orderData) {
        return res.status(500).json({ error: 'Unable to read orders data' });
      }
      orders = orderData.orders;
    }

    const userOrders = orders.filter(order => order.username.toLowerCase() === username.toLowerCase());
    res.json({ orders: userOrders });
  } catch (error) {
    console.error('Order fetch failed:', error);
    res.status(500).json({ error: 'Unable to read orders data' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

connectMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`Food backend listening on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize backend:', error);
  process.exit(1);
});
