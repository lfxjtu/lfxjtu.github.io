const express = require('express');
const session = require('express-session');
const conn = require('./dbConfig');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

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

// Authentication for admin

const authenticateAdmin = (req, res, next) => {
    if (req.session.loggedinAdmin) {
        next();
    } else {
        res.send('Please login to view this page!');
    }
};

// Set storage engine for multer
const storage = multer.diskStorage({
    destination: './public/images/',
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
})

// Init multer upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }, // 1MB limit
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
}).single('imageFile');

// Check file type

function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Images Only!'));
    }
}


// Routes
app.get('/', (req, res) => {
    res.render("home");
});

app.get('/login', (req, res) => {
    res.render('login.ejs');
});

// Show all the products
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
                products: productsResult,
                customerDiscount: 1
            };

            if (req.session.loggedin) {
                loyaltyId = req.session.customer.loyaltyId;
                conn.query('SELECT discount FROM loyalty WHERE loyaltyId = ?', [loyaltyId], (error, result) => {
                    if (error) {
                        console.error("Database error:", error);
                        res.status(500).send('Internal Server Error');
                        return;
                    }
                    if (result.length > 0) {
                        console.log("Discount Query Result: ", result)
                        data.customerDiscount = result[0].discount;
                        console.log("customer discount: ", data.customerDiscount)
                    }
                    console.log("data: ", data)
                    res.render('products', { title: 'List of GG products', data: data });
                })
            } else {
                console.log("data: ", data)
                res.render('products', { title: 'List of GG products', data: data });
            }
        });
    });
});


app.post('/customerAuth', (req, res) => {
    const name = req.body.username;
    const password = req.body.password;
    
    if (name && password) {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                console.error("Error hashing password:", err);
                res.status(500).send('Internal Server Error');
                return;
            }
            conn.query('SELECT * FROM customers WHERE name = ?', [name], (error, results, fields) => {
                if (error) {
                    console.error("Database error:", error);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                if (results.length > 0) {
                    bcrypt.compare(password, results[0].password, (err, result) => {
                        if (err) {
                            console.error("Error comparing passwords:", err);
                            res.status(500).send('Internal Server Error');
                            return;
                        }
                        if (result) {
                            req.session.loggedin = true;
                            req.session.username = name;
                            req.session.customer = results[0];
                            console.log("User", name, "logged in successfully");
                            res.redirect('customerProfile');
                        } else {
                            console.log("User", name, "attempted to log in but failed");
                            res.status(401).send('Incorrect Username and/or Password!');
                        }
                    });
                } else {
                    console.log("User", name, "not found");
                    res.status(401).send('Incorrect Username and/or Password!');
                }
            });
        });
    } else {
        res.status(400).send('Please enter Username and Password!');
    }
});


app.get('/customerUpdateProfile', authenticate, (req, res) => {
    res.render('customerUpdateProfile.ejs', {customer: req.session.customer});
})

app.post('/customerUpdateProfile', authenticate, (req, res) => {
    let customer = req.session.customer;
    let password = req.body.password;
    const sql = `UPDATE customers SET name = ?, password = ?, phone = ?, email = ?, address =? WHERE id = ?`;
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error("Error hashing password:", err);
            res.status(500).send('Internal Server Error');
            return;    
        }
        conn.query(sql, [req.body.name, hash, req.body.phone, req.body.email, req.body.address, customer.id], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                res.status(500).send('Internal Server Error');
                return; 
            }
            console.log('customer record self updated');
            // Update session data with the new customer information
            req.session.customer = {
                id: customer.id,
                name: req.body.name,
                password: hash,
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
    })
    
});

// Customer register

// Serve the registration form
app.get('/customerRegister', (req, res) => {
    res.render("customerRegister")});

// Handle customer registration
app.post('/customerRegister', (req, res) => {
    conn.query("SELECT MAX(id) as maxId FROM customers", (err, result) => {
        if (err) throw err;
        const newCustomerId = result[0].maxId + 1;

        //Hash password while registering
        bcrypt.hash(req.body.password, 10, (err, hash) =>{
            if(err) throw err;

            const sql = `INSERT INTO customers (id, name, password, phone, email, address, balance) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            conn.query(sql, [newCustomerId, req.body.name, hash, req.body.phone, req.body.email, req.body.address, 0], (error, result) => {
                if (error) throw error;
                console.log('record inserted: ');
                req.session.customer = req.body;
                res.redirect("/login");
            });
        })
    });
});

// Render customer Profile Page
app.get('/customerProfile', authenticate, (req, res) => {
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
    
});

// admin module
// admin login

app.get('/adminLogin', (req, res) => {
    res.render('adminLogin.ejs');
});

app.post('/adminAuth', (req, res) => {
    const name = req.body.username;
    const password = req.body.password;
    
    if (name && password) {
        conn.query('SELECT * FROM admin WHERE name = ? AND password = PASSWORD(?)', [name, password], (error, results, fields) => {
            if (error) throw error;
            if (results.length > 0) {
                req.session.loggedinAdmin = true;
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
app.get('/adminsOnly', authenticateAdmin, (req, res) => {
    res.render('adminsOnly', {
        username: req.session.username,
        role: req.session.role
    });
});

// Add a customer
app.get('/addCustomers', authenticateAdmin, (req, res) => {
    res.render('addCustomers');
});

app.post('/addCustomers', authenticateAdmin, (req, res) => {
     const { name, password, phone, balance } = req.body;
     
     //Hash password for new customer
     bcrypt.hash(password, 10, (err, hash) =>{
        if(err) throw err;
        const sql = `INSERT INTO customers (name, password, phone, balance) VALUES (?, ?, ?, ?)`;
        conn.query(sql, [name, hash, phone, balance], (err, result) => {
            if (err) throw err;
            console.log('record inserted');
            res.redirect('manageCustomers');
        });
    });
});

// Update a customer
app.get('/updateCustomers', authenticateAdmin, function (req, res, next) {
    conn.query(`SELECT * FROM loyalty`, (err, result) =>{
        if (err) throw err;
        let loyalties = result;
        let customerId = req.query.id;
        console.log('id to be updated: ', customerId);
        conn.query("SELECT * FROM customers WHERE id = ?", customerId, function (err, result) {
            if (err) throw err;
            let customer = result[0];
            res.render('updateCustomers', { customerData: {customer, loyalties}});
        });
    })
});

app.post('/updateCustomers', authenticateAdmin, (req, res) => {
    let id = req.query.id;
    console.log('id to be updated: ', req.query.id);
    const { name, phone, balance, loyaltyId } = req.body;
    const sql = `UPDATE customers SET name = ?, phone = ?, balance = ?, loyaltyId = ? WHERE id = ?`;
    conn.query(sql, [name, phone, balance, loyaltyId, id], (err, result) => {
        if (err) throw err;
        console.log('record updated');
        res.redirect('manageCustomers');
    });
    
});

// List all the customers
app.get('/manageCustomers', authenticateAdmin, (req, res) => {
    // Query to show all customers joint with loyalty assocated
    const customersQuery =
    "SELECT customers.*, loyalty.* FROM customers INNER JOIN loyalty on customers.loyaltyId = loyalty.loyaltyId";

    conn.query(customersQuery, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.render('manageCustomers', { title: 'List of GG customers', CustomersData: result });
    });
});

// Delete a customer
app.get('/deleteCustomer', authenticateAdmin, function (req, res, next) {
    let customerId = req.query.id;
    conn.query("DELETE FROM customers WHERE id = ?", customerId, function (err, result) {
        if (err) throw err;
        res.redirect('/manageCustomers');
        });
});

//TODO manage products

// Add a product
app.get('/addProduct', authenticateAdmin, (req, res) => {
    conn.query(`SELECT * FROM categories`, function (err, result){
        if (err) throw err;
        res.render('addProduct', { title: 'Add a product', categories: result, errorMessage: null});

    })
});

app.post('/addProduct', authenticateAdmin, (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            conn.query(`SELECT * FROM categories`, function (err, result){
                if (err) {
                    console.error("Database error: ", err);
                    return res.status(500).send('Internal Server Error');
                };
                res.render('addProduct', { 
                    title: 'Add a product', 
                    categories: result,
                    errorMessage: err ? err.message : 'Unknown error occurred'
                });
            });
        } else {            
            const { name, stock, price, unit, categoryId } = req.body;
            const imageUrl = req.file ? 'public/images/' + req.file.filename : ''; // If no file uploaded then emtpy 
            const sql = `INSERT INTO products (name, stock, price, unit, categoryId, imageUrl) VALUES (?, ?, ?, ?, ?, ?)`;
            conn.query(sql, [name, stock, price, unit, categoryId, imageUrl], (err, result) => {
                if (err) {
                    console.error('Error inserting product: ', err);
                    res.status(500).send('Internal Server Error');
                } else {
                    console.log(result);
                    console.log('New product is added')
                    res.redirect('/manageProducts');    
                }
            });
        }
    })
});

app.get('/manageProducts', authenticateAdmin, (req, res) => {
    // Prepare products data table from products table and category table
    const productDataQuery =
    "SELECT products.*, categories.name AS category FROM products INNER JOIN categories WHERE products.categoryId = categories.id";

    conn.query(productDataQuery, (err, result) => {
        if (err) throw err;
        console.log(result);
        res.render('manageProducts', { title: 'List of GG Products', ProductsData: result });
    });
});

// Delete a product
app.get('/deleteProduct', authenticateAdmin, function (req, res, next) {
 
    let productId = req.query.id;
    conn.query("DELETE FROM products WHERE id = ?", productId, function (err, result) {
        if (err) throw err;
        res.redirect('/manageProducts');
    });
});

// Update a product
app.get('/updateProducts', authenticateAdmin, function (req, res, next) {
    conn.query(`SELECT * FROM categories`, function (err, result){
        if (err) throw err;
        let categories = result;
        let productId = req.query.id;
        conn.query("SELECT * FROM products WHERE id = ?", productId, function (err, result) {
            if (err) throw err;
            let product = result[0];
            res.render('updateProducts', { productsData: {categories, product} });
        });
    }) 
});

app.post('/updateProducts', authenticateAdmin, (req, res) => {
    let id = req.query.id;
    upload(req, res, (err) => {
        if (err) {
            console.error('Error uploading file:', err);
            res.status(400).send('Error uploading file: ', err);
        } else {
            const { name, stock, price, unit, categoryId } = req.body;
            const imageUrl = req.file ? 'public/images/' + req.file.filename : ''; // If no file uploaded then emtpy 
            const sql = `UPDATE products SET name = ?, stock = ?, price = ?, unit = ?, categoryId = ?, imageUrl = ? WHERE id = ?`;
            conn.query(sql, [name, stock, price, unit, categoryId, imageUrl, id], (err, result) => {
                if (err) {
                    console.error('Error uploading product:', err);
                    res.send(500).send('Internal Server Error');
                } else {
                    console.log('Product updated successfully');
                    res.redirect('manageProducts');
                }
            });
        }
    })
    
});

// Log out
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, () => {
    console.log('Node app is running on port 3000');
});
