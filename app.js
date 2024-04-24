const express = require('express');
const session = require('express-session');
const conn = require('./dbConfig');

const app = express();

// Middleware
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'yoursecret',
    resave: true,
    saveUninitialized: true
}));
app.use('/public', express.static('public'));

// Middleware for authentication
const authenticate = (req, res, next) => {
    if (req.session.loggedin) {
        next();
    } else {
        res.send('Please login to view this page!');
    }
};

// Routes
app.get('/', (req, res) => {
    res.render("home");
});

app.get('/login', (req, res) => {
    res.render('login.ejs');
});
 
app.post('/auth', (req, res) => {
    const name = req.body.username;
    const password = req.body.password;
    
    if (name && password) {
        conn.query('SELECT * FROM admin WHERE name = ? AND password = ?', [name, password], (error, results, fields) => {
            if (error) throw error;
            if (results.length > 0) {
                req.session.loggedin = true;
                req.session.username = name;
                res.redirect('/adminsOnly');
            } else {
                res.send('Incorrect Username and/or Password!');
            }
        });
    } else {
        res.send('Please enter Username and Password!');
    }
});

// Users can access this if they are logged in
app.get('/adminsOnly', authenticate, (req, res) => {
    res.render('adminsOnly', {
        username: req.session.username
    });
});

// Add Customers module
app.get('/addCustomers', authenticate, (req, res) => {
    res.render('addCustomers');
});

app.post('/addCustomers', authenticate, (req, res) => {
    const { id, name, password, phone, balance } = req.body;
    const sql = `INSERT INTO customers (id, name, password, phone, balance) VALUES (?, ?, ?, ?, ?)`;
    conn.query(sql, [id, name, password, phone, balance], (err, result) => {
        if (err) throw err;
        console.log('record inserted');
        res.redirect('listCustomers');
    });
});

// Update a customer module
app.get('/updateCustomers', authenticate, (req, res) => {
    res.render('updateCustomers');
});

app.post('/updateCustomers', authenticate, (req, res) => {
    const { id, name, password, phone, balance } = req.body;
    const sql = `UPDATE customers SET name = ?, password = ?, phone = ?, balance = ? WHERE id = ?`;
    conn.query(sql, [name, password, phone, balance, id], (err, result) => {
        if (err) throw err;
        console.log('record updated');
        res.redirect('listCustomers');
    });
});

app.get('/listCustomers', authenticate, (req, res) => {
    conn.query("SELECT * FROM customers", (err, result) => {
        if (err) throw err;
        console.log(result);
        res.render('listCustomers', { title: 'List of GG customers', CustomersData: result });
    });
});

app.get('/products', (req, res) => {
    conn.query("SELECT * FROM products", (err, result) => {
        if (err) throw err;
        console.log(result);
        res.render('products', { title: 'List of GG products', ProductsData: result });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(3000, () => {
    console.log('Node app is running on port 3000');
});
