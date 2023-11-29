const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const app = express()

app.use(cors())
app.use(express.json())
app.use(cookieParser())

const port = process.env.PORT || 5000

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@node-express.sczsc.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect()

    const userCollection = client.db('EmployeeManagement').collection('Users')
    const taskCollection = client.db('EmployeeManagement').collection('Tasks')
    const paymentCollection = client
      .db('EmployeeManagement')
      .collection('Payments')

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      })
      res.send({ token })
    })

    // middlewares

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        console.log('No token found')
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1]
      console.log('Token:', token)
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.log('Token verification failed:', err)
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded
        next()
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    const verifyHR = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isHR = user?.role === 'hr'
      if (!isHR) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    const verifyEmployee = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isEmployee = user?.role === 'employee'
      if (!isEmployee) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    // user related api

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.findOne(query)
      res.send(result)
    })

    app.patch('/users/:id', async (req, res) => {
      console.log('Received PATCH request:', req.params.id)
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updatedStatus = req.body
      console.log(updatedStatus)
      const updateDoc = {
        $set: {
          role: updatedStatus.role,
          isVerified: updatedStatus.isVerified,
        },
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // fire employee
    app.patch('/users/fire/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          isFired: true,
          email: null,
        },
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })

    app.get('/users/hr/:email', verifyToken, async (req, res) => {
      const email = req.params.email

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query)
      let hr = false
      if (user) {
        hr = user?.role === 'hr'
      }
      res.send({ hr })
    })

    app.get('/users/employee/:email', verifyToken, async (req, res) => {
      const email = req.params.email

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query)
      let employee = false
      if (user) {
        employee = user?.role === 'employee'
      }
      res.send({ employee })
    })

    app.get('/employees', async (req, res) => {
      const result = await userCollection.find({ role: 'employee' }).toArray()
      res.send(result)
    })

    app.get('/employees/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.findOne(query)
      res.send(result)
    })

    app.patch('/employees/:id', async (req, res) => {
      console.log('Received PATCH request:', req.params.id)
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updatedStatus = req.body
      console.log(updatedStatus)
      const updateDoc = {
        $set: {
          isVerified: updatedStatus.isVerified,
        },
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body
      user.isVerified = false
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    // task related api

    app.post('/tasks', verifyToken, verifyEmployee, async (req, res) => {
      const item = req.body
      const result = await taskCollection.insertOne(item)
      res.send(result)
    })

    app.get('/tasks', async (req, res) => {
      const result = await taskCollection.find().toArray()
      res.send(result)
    })

    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      console.log('Request Body:', req.body)
      const { salary, selectedMonth, selectedYear } = req.body
      const amount = parseInt(salary * 100)
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        metadata: {
          selectedMonth,
          selectedYear,
        },
        payment_method_types: ['card'],
      })

      res.send({ paymentIntent, clientSecret: paymentIntent.client_secret })
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body
      const paymentResult = await paymentCollection.insertOne(payment)
      res.send({ paymentResult })
    })

    app.get('/payments', verifyToken, async (req, res) => {
      const result = await paymentCollection.find().toArray()
      res.send(result)
    })

    app.get('/payments/check/:month/:year', verifyToken, async (req, res) => {
      try {
        const { month, year } = req.params
        const query = {
          selectedMonth: month,
          selectedYear: year,
          email: req.decoded.email,
        }

        const existingPayment = await paymentCollection.findOne(query)

        res.send({ paymentMade: !!existingPayment })
      } catch (error) {
        console.error('Error checking payment status', error)
      }
    })

    //  Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close()
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('employee management app is running...')
})

app.listen(port, () => {
  console.log(`employee management app is listening to port ${port}`)
})
