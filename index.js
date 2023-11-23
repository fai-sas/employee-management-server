const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const app = express()

app.use(express.json())
app.use(cookieParser())

const port = process.env.PORT || 5000

app.get('/', (req, res) => {
  res.send('employee management app is running...')
})

app.listen(port, () => {
  console.log(`employee management app is listening to port ${port}`)
})
