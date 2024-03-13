import express from 'express'
import axios from 'axios'
import fs from 'fs'
import swaggerjsdoc from 'swagger-jsdoc'
import swaggerui from 'swagger-ui-express'
import dotenv from 'dotenv'
import amqp from 'amqplib'

dotenv.config()

const app = express()

app.use(express.json())

app.use(express.static('public'))

var mqChannel
var mqConnection

(async () => {
  const conStr = `amqp://admin:admin@${process.env.RABBITMQ_HOST}:5672/`
    try {
      console.log(`Trying to connect to RabbitMQ at ${process.env.RABBITMQ_HOST}:5672`)

      const rmq = await createConnection(conStr)

      mqConnection = rmq.connection
      mqChannel = rmq.channel
    } catch (err) {
      console.log(err.message)
    }
})()


async function createConnection(conStr) {
    try {
      const connection = await amqp.connect(conStr)
      console.log(`Connected to rabbitmq using ${conStr}`)
  
      const channel = await connection.createChannel()
      console.log(`Channel created`)
  
      return { connection, channel }
    } catch (err) {
      console.log(`Failed to connect to queue in createConection function`)
      throw err
    }
}

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
          title: 'Submit API',
          description: "API endpoints for the submit microservice documented on swagger",
          version: '1.0.0',
        },
        servers: [
          {
            url: "http://10.0.0.4:4200/",
            description: "Current Server"
          }
        ]
      },
      apis: ["./app.js"]
}

const spacs = swaggerjsdoc(options)

app.use("/docs", swaggerui.serve, swaggerui.setup(spacs))


/**
 * @swagger
 * /types:
 *   get:
 *     summary: Retrieve a list of joke types
 *     description: Retrieve a list of Joke types via an http request to another microservice. If this is not accessible, the data is retrieved from a previously backed up data file.
 *     responses:
 *       200:
 *         description: A list of joke types.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: The type ID.
 *                     example: 0
 *                   name:
 *                     type: string
 *                     description: The type name.
 *                     example: Puns
 */
app.get("/types", async (req, res) => {
    let types

    try {
        const response = await axios.get(`http://${process.env.JOKE_APP}:4000/type`)

        types = response.data

        saveTypes(types)
    } catch (error) {
        try {
            const data = fs.readFileSync('types.json', 'utf8')

            types = JSON.parse(data)
        } catch (err) {
            return res.status(500).send('Internal server error')
        }
    }
    
    res.status(200).send(types)
})

/**
 * @swagger
 * /sub:
 *   post:
 *     summary: The new joke is written to the message queue
 *     description: Receives the new joke posted from the UI. The new joke is written to the message queue.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               joke:
 *                 type: string
 *                 description: The joke.
 *                 example: What do cows do on date night?, Go to the moo-vies
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 joke:
 *                   type: string
 *                   description: The joke.
 *                   example: What do cows do on date night?, Go to the moo-vies
 */
app.post("/sub", async (req, res) => {
    try{
        const joke = req.body.joke

        await sendMessageToQueue(joke)

        res.status(201).send(joke)
    } catch(error)  {
        res.status(500).send('Internal Server Error')
    }
})

async function saveTypes(types)  {
    const data = JSON.stringify(types)

    fs.writeFileSync('/app/backup/types.json', data, (err) => {
        if(err) throw err
    })
}

app.listen(3200, () => {
    console.log("Server is running on port 3200")
})

async function sendMessageToQueue(message)   {
    await mqChannel.assertQueue(process.env.RABBITMQ_QN, {
        durable: true
    })

    await mqChannel.sendToQueue(process.env.RABBITMQ_QN, Buffer.from(JSON.stringify(message)))
}