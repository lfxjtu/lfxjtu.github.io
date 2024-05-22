/**
 * This code snippet retrieve all the customers from database, and then hash them.
 * TODO: only hash those which hasn't been hashed.
 */

// Import necessary modules
const bcrypt = require('bcrypt');
const conn = require('./dbConfig');

// Retrieve all customers from the database
conn.query("SELECT * FROM customers ORDER BY id", (err, customers) => {
    if (err) {
        console.error("Database error:", err);
        process.exit(1);
    }

    // Iterate through each customer
    customers.forEach(customer => {
        const customerId = customer.id;
        const password = customer.password;

        // Hash the password if it's not already hashed
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                console.error("Error hashing password:", err);
                process.exit(1);
            }

            // Update the customer record with the hashed password
            conn.query("UPDATE customers SET password = ? WHERE id = ?", [hash, customerId], (err, result) => {
                if (err) {
                    console.error("Database error:", err);
                    process.exit(1);
                }
                console.log(`Password for customer with ID ${customerId} has been updated.`);
            });
        });
    });
});
