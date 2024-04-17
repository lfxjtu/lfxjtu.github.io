var express = require('express');
var app = express();
app.set('view engine','ejs');

app.use('/public', express.static('public'));

app.get('/', function (req,res){
    res.render("home");
});
app.get('/fruit', function (req, res){
    res.render("fruit");
});
app.get('/vegetables', function (req, res){
    res.render("vegetables");
});
app.listen(3000);
console.log('Node app is running on port 3000');
