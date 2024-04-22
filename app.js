var express = require('express');
var app = express();
var session = require('express-session');
var conn = require('./dbConfig');
app.set('view engine','ejs');
app.use(session({
    secret: 'yoursecret',
    resave: true,
    saveUninitialized: true
}));
app.use('/public', express.static('public'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', function (req,res){
    res.render("home");
});
app.get('/login', function(req, res) {
    res.render('login.ejs');
});
 
app.post('/auth', function(req, res){
    let name = req.body.username;
    let password = req.body.password;
    if (name && password) {
        conn.query('SELECT * FROM admin WHERE name = ? AND password = ?', [name,password],
        function(error, results, fields) {
            if (error) throw error;
            if ( results.length > 0) {
                req.session.loggedin = true;
                req.session.username = name;
                res.redirect('/membersOnly');
            } else {
                res.send('Incorrect Username and/or Password!');
            }
            res.end();
        });
    } else {
        res.send('Please enter Usename and Password!');
        res.end();
    }
});
// Users can access this if they are logged in
app.get('/membersOnly', function (req,res, next) {
    if (req.session.loggedin) {
        res.render('membersOnly', {
            username: req.session.username
        });
    }
    else {
        res.send('Please login to view this page!');
    }
});

app.get('/addCustomers', function (req,res, next) {
    if (req.session.loggedin) {
        res.render('addCustomers');
    }
    else {
        res.send('Please login to view this page!');
    }
});
app.post('/addCustomers', function(req,res,next) {
    var id = req.body.id;
    var name = req.body.name;
    var password = req.body.password;
    var phone = req.body.phone;
    var balance = req.body.balance;
    var sql = `INSERT INTO customers (id, name, password, phone, balance) VALUES ("${id}", "${name}", "${password}", "${phone}", "${balance}")`;
    conn.query(sql, function(err,result) {
        if (err) throw err;
        console.log( 'record inserted');
        res.render('addCustomers');
    });
});
app.get('/listCustomers', function(req,res){
    conn.query("SELECT * FROM customers", function (err, result) {
        if  (err)throw err;
        console.log(result);
        res.render('listCustomers', { title: 'List of GG customers', CustomersData: result});
    });
});
app.get('/products', function (req, res){
    conn.query("SELECT * FROM products", function (err, result) {
        if  (err)throw err;
        console.log(result);
        res.render('products', { title: 'List of GG products', ProductsData: result});
    });
});

app.get('/logout',(req,res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(3000);
console.log('Node app is running on port 3000');