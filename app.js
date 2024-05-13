const express = require('express');
const session = require('express-session');
const conn = require('./dbConfig');

const bcrypt = require('bcrypt');

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

// Customer module
app.post('/customerAuth', (req, res) => {
    const name = req.body.username;
    const password = req.body.password;
    
    if (name && password) {
        conn.query('SELECT * FROM customers WHERE name = ? AND password = ?', [name, password], (error, results, fields) => {
            if (error) throw error;
            if (results.length > 0) {
                req.session.loggedin = true;
                req.session.username = name;
                req.session.customer = results[0];
                console.log(req.session.customer);
                res.redirect('customerProfile');
            } else {
                console.log("User " + name + " attempted to log in but failed")
                res.send('Incorrect Username and/or Password!');
            }
        });
    } else {
        res.send('Please enter Username and Password!');
    }
});

app.get('/updateCustomerProfile', authenticate, (req, res) => {
    res.render('updateCustomerProfile.ejs', {customer: req.session.customer});
})

app.post('/updateCustomerProfile', authenticate, (req, res) => {
    let customer = req.session.customer;
    const sql = `UPDATE customers SET name = ?, password = ?, phone = ?, email = ?, address =? WHERE id = ?`;
    conn.query(sql, [req.body.name, req.body.password, req.body.phone, req.body.email, req.body.address, customer.id], (err, result) => {
        if (err) throw err;
        console.log('customer record self updated');
        // Update session data with the new customer information
        req.session.customer = {
            id: customer.id,
            name: req.body.name,
            password: req.body.password,
            phone: req.body.phone,
            email: req.body.email,
            address: req.body.address,
            balance: customer.balance,
            loyalty: customer.loyalty,
            discount: customer.discount
        };
        console.log('new customer info: ', req.session.customer);
        res.render('customerProfile.ejs', { customer: req.session.customer });
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
            console.log('record inserted: ');
            req.session.customer = req.body;
            res.redirect("/login");
        });
    });
});

// Render customer Profile Page
app.get('/customerProfile', authenticate, (req, res) => {
    if (req.session.loggedin) {
        const customerData = req.session.customer;
        const customerLoyaltyId = customerData.loyaltyId;
        const sql = `SELECT level, discount from loyalty where loyaltyId = ?`;
        conn.query(sql, customerLoyaltyId, (err, result) => {
            if (err) throw err;
            loyalty = result[0].level;
            discount = result[0].discount;
            customerData['loyalty'] = loyalty;
            customerData['discount'] = discount;
            res.render('customerProfile', { customer: customerData });

        })
    } else {
        // Redirect to login page or handle unauthorized access
        res.redirect('/login');
    }
});

// admin module

app.get('/adminLogin', (req, res) => {
    res.render('adminLogin.ejs');
});

app.post('/adminAuth', (req, res) => {
    const name = req.body.username;
    const password = req.body.password;
    
    if (name && password) {
        conn.query('SELECT * FROM admin WHERE name = ? AND password = ?', [name, password], (error, results, fields) => {
            if (error) throw error;
            if (results.length > 0) {
                req.session.loggedin = true;
                req.session.username = name;
                req.session.role = results[0].role;
                res.redirect('/adminsOnly');
            } else {
                console.log("User " + name + " attempted to log in but failed")
                res.send('Incorrect Username and/or Password!');
            }
        });
    } else {
        res.send('Please enter Username and Password!');
    }
});

// Admin can access this if they are logged in
app.get('/adminsOnly', authenticate, (req, res) => {
    res.render('adminsOnly', {
        username: req.session.username,
        role: req.session.role
    });
});

// Add a customer
app.get('/addCustomers', authenticate, (req, res) => {
    res.render('addCustomers');
});

app.post('/addCustomers', authenticate, (req, res) => {
    let newCustomerId = 0;
    conn.query("SELECT MAX(id) as maxId FROM customers", (err, result) => {
        if (err) throw err;
        newCustomerId = result[0].maxId + 1;
        const { name, password, phone, balance } = req.body;
        const sql = `INSERT INTO customers (id, name, password, phone, balance) VALUES (?, ?, ?, ?, ?)`;
        conn.query(sql, [newCustomerId, name, password, phone, balance], (err, result) => {
            if (err) throw err;
            console.log('record inserted');
            res.redirect('manageCustomers');
        });
    });
});

// Update a customer
app.get('/updateCustomers', function (req, res, next) {
    if (req.session.loggedin) {
        let customerId = req.query.id;
        console.log('id to be updated: ', customerId);
        conn.query("SELECT * FROM customers WHERE id = ?", customerId, function (err, result) {
            if (err) throw err;
            console.log('result0: ', result[0]);
            res.render('updateCustomers', { customer: result[0] });
        });
    } else {
        res.send('Please login to view this page!');
    }
});

app.post('/updateCustomers', authenticate, (req, res) => {
    let id = req.query.id;
    console.log('id to be updated: ', req.query.id);
    console.log('req.body: ', req.body)
    const { name, password, phone, balance, loyaltyId } = req.body;
    console.log('loyaltyId: ', loyaltyId);
    const sql = `UPDATE customers SET name = ?, password = ?, phone = ?, balance = ?, loyaltyId = ? WHERE id = ?`;
    conn.query(sql, [name, password, phone, balance, loyaltyId, id], (err, result) => {
        if (err) throw err;
        console.log('record updated');
        res.redirect('manageCustomers');
    });
});

// List all the customers
app.get('/manageCustomers', authenticate, (req, res) => {
    conn.query("SELECT * FROM customers", (err, result) => {
        if (err) throw err;
        console.log(result);
        res.render('manageCustomers', { title: 'List of GG customers', CustomersData: result });
    });
});

// Delete a customer
app.get('/deleteCustomer', function (req, res, next) {
    if (req.session.loggedin) {
        let customerId = req.query.id;
        conn.query("DELETE FROM customers WHERE id = ?", customerId, function (err, result) {
            if (err) throw err;
            res.redirect('/manageCustomers');
        });
    } else {
        res.send('Please login to view this page!');
    }
});

//TODO manage products

app.get('/products', (req, res) => {
    // Query to select all categories
    const categoriesQuery = "SELECT * FROM categories";

    conn.query(categoriesQuery, (err, categoriesResult) => {
        if (err) throw err;

        // Query to select all products
        const productsQuery = 
            "SELECT products.*, categories.name AS category FROM products RIGHT JOIN categories on products.categoryId = categories.id";

        conn.query(productsQuery, (err, productsResult) => {
            if (err) throw err;

            // Combine products and categories into a single object
            const data = {
                categories: categoriesResult,
                products: productsResult
            };

            res.render('products', { title: 'List of GG products', data: data });
        });
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
