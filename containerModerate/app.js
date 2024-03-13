import express from 'express'
import axios from 'axios'
import fs from 'fs'
import lodash from 'lodash'
import amqp from 'amqplib'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

app.use(express.json())

app.use(express.static('public'))

let latestSubmittedJoke;
var receivedData = [];
var subChannel
var subConnection
var modChannel
var modConnection

(async () => {
    console.log(`Trying to connect to RabbitMQ`)

    const modMQ = await createConnection(`amqp://admin:admin@${process.env.RABBITMQMOD_HOST}:5672/`)
    modConnection = modMQ.connection
    modChannel = modMQ.channel

    const subMq = await createConnection(`amqp://admin:admin@${process.env.RABBITMQSUB_HOST}:${process.env.RABBITMQSUB_PORT}/`)
    subConnection = subMq.connection
    subChannel = subMq.channel

    await subChannel.assertQueue(process.env.RABBITMQSUB_QN, { durable: true })
    
    subChannel.consume(process.env.RABBITMQSUB_QN, message => {
        console.log(message.content.toString + " consumed and stored in receivedData")
        receivedData.push(JSON.parse(message.content.toString()))
        subChannel.ack(message)
    })
})().catch((err) => { 
    console.log(`Connection failed`)
}) 

async function createConnection(constring) {
    try {
        const connection = await amqp.connect(constring)
        console.log(`Connected to rabbitmq using ${constring}`)
    
        const channel = await connection.createChannel()
        console.log(`Channel created`)
    
        return { connection, channel }
    } catch (err) {
        console.log(`Failed to connect to rabbitmq: ` + constring)
        throw err
    }
}

app.get('/types', async (req, res) => {
    let types;

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

app.get('/mod', async (req, res) => {
    try{
        console.log(receivedData.length + " is the length of receviedData")
        if(receivedData.length != 0)   {
            let data = await receivedData.pop()
            
            latestSubmittedJoke = {
                joke: {
                    id: data.id,
                    type_id: data.type_id,
                    text: data.text,
                    punchline: data.punchline
                },
                time: new Date()
            }

            res.status(200).send(data)
        } else {
            res.status(404).send('No joke found!')
        }
    } catch(error)  {
        res.status(500).send('Internal Server Error')
    }
})

app.post('/sub', async (req, res) => {
    try{
        const message = req.body.message
        let changed = false

        if(!(lodash.isEqual(message.joke, latestSubmittedJoke.joke)))    {
            changed = true
        }

        let analytics = {
            submittedJoke: {
                id: latestSubmittedJoke.joke.id,
                type_id: latestSubmittedJoke.joke.type_id,
                text: latestSubmittedJoke.joke.text,
                punchline: latestSubmittedJoke.joke.punchline
            },
            moderatedJoke: {
                id: message.joke.id,
                type_id: message.joke.type_id,
                text: message.joke.text,
                punchline: message.joke.punchline
            },
            changed: changed,
            moderator: message.moderator,
            readDateTime: latestSubmittedJoke.time,
            subDateTime: new Date()
        }

        await sendMessageToQueue(process.env.RABBITMQMOD_QN, message.joke)

        await sendMessageToQueue(process.env.RABBITMQANA_QN, analytics)

        res.status(201).send(message.joke)
    } catch(error)  {
        res.status(500).send('Internal Server Error')
    }
})

app.listen(3100, () => {
    console.log("Server is running on port 3100")
})

async function saveTypes(types)  {
    const data = JSON.stringify(types)

    fs.writeFileSync('/app/backup/types.json', data, (err) => {
        if(err) throw err
    })
}


async function sendMessageToQueue(qn, message)   {
    await modChannel.assertQueue(qn, {
        durable: true
    })

    await modChannel.sendToQueue(qn, Buffer.from(JSON.stringify(message)))
}

