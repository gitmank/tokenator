// import express, postgresql and dotenv
const express = require('express');
const { Client } = require('pg');
require('dotenv').config();
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https')

// setting up SSL
const fs = require('fs')
const key = fs.readFileSync('./cert/localhost/localhost.decrypted.key')
const cert = fs.readFileSync('./cert/localhost/localhost.crt')

// define constants
const PORT = 2002;
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const ADMIN_KEY = process.env.ADMIN_KEY;
const DEDUCT_KEY = process.env.DEDUCT_KEY;


// create an express app
const app = express();

// middleware
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// connect to postgresql
const client = new Client({
    user: 'tokenatorapp',
    password: POSTGRES_PASSWORD,
    database: 'tokenatordb',
})
client.connect((err) => {
    if (err) console.error('connection error', err.stack);
    else console.log('connected');
})

// home page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});
// save key page
app.get('/key', (req, res) => {
    res.sendFile(__dirname + '/public/key.html');
});
// scan qr page
app.get('/balance', (req, res) => {
    res.sendFile(__dirname + '/public/balance.html');
});
// transaction page
app.get('/transact', (req, res) => {
    res.sendFile(__dirname + '/public/transact.html');
});
// history page
app.get('/history', (req, res) => {
    res.sendFile(__dirname + '/public/history.html');
});

// fetch card data
app.get('/card/:uuid', async (req, res) => {
    try {
        // calculate card balance
        const { rows } = await client.query('SELECT SUM(amount) FROM transactions WHERE uuid = $1', [req.params.uuid]);
        const balance = rows[0].sum;
        // update card balance
        await client.query('UPDATE cards SET balance = $1 WHERE uuid = $2', [balance, req.params.uuid]);
        // return card data
        const { rows: cardRows } = await client.query('SELECT * FROM cards WHERE uuid = $1', [req.params.uuid]);
        res.end(JSON.stringify(cardRows));
    } catch (error) {
        console.error(error);
        res.status(500).end('Internal Server Error');
    }
});

// fetch transaction data
app.get('/transactions/:uuid', async (req, res) => {
    try {
        const { rows } = await client.query('SELECT * FROM transactions WHERE uuid = $1', [req.params.uuid]);
        res.end(JSON.stringify(rows));
    } catch (error) {
        console.error(error);
        res.status(500).end('Internal Server Error');
    }
});

// insert a transaction
app.put('/transaction/:uuid', async (req, res) => {
    try {
        const uuid = req.params.uuid;
        const { amount, description, key } = req.body;
        if(amount > 0) {
            if(key !== ADMIN_KEY) {
                return res.status(403).end('Forbidden');
            }
        }
        else {
            if(key !== DEDUCT_KEY) {
                return res.status(403).end('Forbidden');
            }
        }
        // check if balance + amount is greater than 0
        const { rows: cardRows } = await client.query('SELECT * FROM cards WHERE uuid = $1', [uuid]);
        if(parseInt(cardRows[0]?.balance || 0) + parseInt(amount || 0) < 0) {
            return res.status(400).end('Insufficient Balance');
        }
        const { rows } = await client.query('INSERT INTO transactions (uuid, amount, description, timestamp) VALUES ($1, $2, $3, $4) ', [uuid, amount, description, new Date().toDateString()]);
        res.status(200).end('success');
    } catch (error) {
        console.error(error);
        res.status(500).end('Internal Server Error');
    }
});

// start express server on port
const server = https.createServer({ key, cert }, app)
server.listen(PORT, () => {
  console.log(`Server is listening on https://localhost:${PORT}`)
})