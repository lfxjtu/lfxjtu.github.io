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

// Customer register

// Serve the registration form
app.get('/customerRegister', (req, res) => {
    res.render("customerRegister")});

// Handle customer registration
app.post('/customerRegister', (req, res) => {
    let newCustomerId = 0;
    conn.query("SELECT MAX(id) as maxId FROM customers", (err, result) => {
        if (err) throw err;
        newCustomerId = result[0].maxId + 1;
        const sql = `INSERT INTO customers (id, name, password, phone, email, address, balance) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        conn.query(sql, [newCustomerId, req.body.name, req.body.password, req.body.phone, req.body.email, req.body.address, 0], (error, result) => {
            if (error) throw error;
            console.log('record inserted');
            res.redirect("/customerProfile");
        });
    });
});

// Customer Profile Page
app.get('/customerProfile', (req, res) => {
    res.render("customerProfile")});




// Add a customer
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

// Update a customer
app.get('/updateCustomers', function (req, res, next) {
    if (req.session.loggedin) {
        let customerId = req.query.id;
        conn.query("SELECT * FROM customers WHERE id = ?", customerId, function (err, result) {
            if (err) throw err;
            res.render('updateCustomers', { customer: result[0] });
        });
    } else {
        res.send('Please login to view this page!');
    }
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

// List all the customers
app.get('/listCustomers', authenticate, (req, res) => {
    conn.query("SELECT * FROM customers", (err, result) => {
        if (err) throw err;
        console.log(result);
        res.render('listCustomers', { title: 'List of GG customers', CustomersData: result });
    });
});


// Delete a customer
app.get('/deleteCustomer', function (req, res, next) {
    if (req.session.loggedin) {
        let customerId = req.query.id;
        conn.query("DELETE FROM customers WHERE id = ?", customerId, function (err, result) {
            if (err) throw err;
            res.redirect('/listCustomers');
        });
    } else {
        res.send('Please login to view this page!');
    }
});

//TODO manage products

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
