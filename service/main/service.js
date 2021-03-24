process.env['NODE_CONFIG_DIR'] = './config/';

const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const winston = require('winston');
const { MongoClient, ObjectId } = require('mongodb');
const validator = require('express-validator');
const _ = require('lodash');
const RouteClient = require('cortex-route-client');
const config = require('config');

const mongo_url = config.get("mongo");

const log = winston.createLogger({
    level: 'silly',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

let app = express();
let _db = undefined;
let routeClient = new RouteClient();

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(validator());

MongoClient.connect(mongo_url, function(err, db) {

    if (err) {
        log.error("Mongo DB connection has been failed.");
        throw err;
    }

    log.info("Mongo DB connection has been provided.");
    _db = db.db("cortex-chain");

    // What if task is not mine
    app.get('/task', function(req, res) {
        log.debug("Query Task method is being called");
        req.checkQuery('task_id', 'Task Id is required!').notEmpty();
        req.checkQuery('role', 'Role is required!').notEmpty();
        let errors = req.validationErrors();
        if (errors) {
            res.status(403).send(_.map(errors, err => { return err.msg; }));
            return;
        }
        log.debug("Params are validated");
        let task_id = req.query.task_id;
        let role = req.query.role;

        _db.collection("tasks").findOne({"_id" : ObjectId(task_id)}, function (err, result) {
            if(err != null) {
                log.error("DB returned error.");
                res.status(503).send(err);
                return;
            }

            if(result == null) {
                res.status(404).send("There is no such task!");
                return;
            }

            let answer = {
                task_id: task_id,
                created: result.created,
                stage: 0
            };
            if (role == 'worker') {
                // Bring only authority details
                routeClient.query_routes(result.authority)
                    .then(function(r) {
                        answer.route = _.first(r.data);
                        res.json(answer);
                    })
                    .catch(function (err) {
                        log.error(err.toString());
                        res.status(500).send("Internal Service Error");
                        return;
                    });

            } else if (role == 'authority') {
                routeClient.query_routes(result.peers)
                    .then(function(r){
                        answer.route = r.data;
                        res.json(answer);
                    })
                    .catch(function (err) {
                        log.error(err.toString());
                        res.status(500).send("Internal Service Error");
                        return;
                    });
            } else {
                log.error("Unknown role!");
                res.status(500).send("Internal Service Error");
                return;
            }
        });
    });

    app.get('/signature', function(req, res) {
        req.checkQuery('account', 'Account is required!').notEmpty();
        let errors = req.validationErrors();
        if (errors) {
            res.status(403).send(_.map(errors, err => { return err.msg; }));
            return;
        }
        log.debug("Params are validated");
        let account = req.query.account;

        // bring public key of account findBy account
        _db.collection("accounts").findOne({"_id" :ObjectId(account)}, function (err, result) {
            if(err != null) {
                log.error("DB returned error.");
                res.status(503).send(err);
                return;
            }

            if(result == null) {
                res.status(404).send("There is no such account!");
                return;
            }

            res.json({
                account: account,
                created: result.created,
                updated: result.updated,
                signature: result.signature
            });
        });
    });

    app.listen(config.get("service_port"), function() {
        log.info("cortex-chain started.");
    });
});

module.exports = app;