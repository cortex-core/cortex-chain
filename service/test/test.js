const chai = require('chai');
const chai_http = require('chai-http');
const _ = require('lodash');
const chai_date_string = require('chai-date-string');
const MongoClient = require("mongodb").MongoClient;
const MongoClientMock = require('mongo-mock').MongoClient;
const ObjectId = require('mongo-mock').ObjectId;
const log = require('cortex-route-shared').log;
const sinon = require('sinon');
const Client = require('cortex-route-client');

chai.should();
chai.use(chai_http);
chai.use(chai_date_string);

describe('cortex-chain simple tests', function() {

    let mongo_stub;
    let service;
    let _db;
    let cortex_route_client_stub;

    before(function(){
        return new Promise(function (resolve) {
            log.info("Initializing testing bed...");

            mongo_stub = sinon.stub(MongoClient, 'connect');
            cortex_route_client_stub = sinon.stub(Client.prototype, 'query_routes');

            MongoClientMock.connect('mongodb://mongodb:27017/', function(db_err, db) {
                chai.should().equal(db_err, null);
                _db = db.db("cortex-chain");
                _db.collection("tasks").insert({_id: ObjectId('7df78ad8902c'), authority:'address1', peers:['address2'], created:'2016-05-18T16:00:00.000Z'}, function(err) {
                    chai.should().equal(err, null);
                    _db.collection("accounts").insert({_id: ObjectId('7df78ad890df'), created:'2016-05-18T16:00:00.000Z', updated:'2016-05-18T16:00:00.000Z', signature: 'HASH'}, function(err) {
                        chai.should().equal(err, null);
                        mongo_stub.callsFake(function (url, cb) {
                            cb(null, db);
                        });
                        cortex_route_client_stub.callsFake(function (peers) {
                            return new Promise(function (resolve) {
                                resolve({
                                    data:[{
                                        peer_id: "5cfc132069797719de6b3940",
                                        address: "127.0.0.1:46786"
                                    },{
                                        peer_id: "5cfc132069797719de6b3941",
                                        address: "127.0.0.1:46723"
                                    }]
                                });
                            });
                        });
                        service = require('./../main/service');
                        resolve();
                    });
                });
            });
        });
    });

    after(function(){
        log.info("Finalizing testing bed...");
        mongo_stub.restore();
        cortex_route_client_stub.restore();
    });

    it('should provide interface via /query_task GET endpoint to query routes as worker', function(done){
        chai.request(service)
            .get('/task')
            .query({'task_id': '7df78ad8902c', 'role': 'worker'})
            .send()
            .end(function(err, res){
                chai.should().equal(err, null);
                res.should.have.status(200);
                res.should.be.json;
                res.body.stage.should.equal(0, "We should have set 0 hardcoded!");
                res.body.task_id.should.equal('7df78ad8902c', "");
                chai.should().exist(res.body.created);
                chai.should().exist(res.body.route);
                done();
            });
    });

    it('should provide interface via /query_task GET endpoint to query routes as authority', function(done){
        chai.request(service)
            .get('/task')
            .query({'task_id': '7df78ad8902c', 'role': 'authority'})
            .end(function(err, res){
                chai.should().equal(err, null);
                res.should.have.status(200);
                res.should.be.json;
                res.body.stage.should.equal(0);
                res.body.task_id.should.equal('7df78ad8902c');
                chai.should().exist(res.body.created);
                chai.should().exist(res.body.route);
                res.body.route.should.be.an('array');
                res.body.route.should.have.lengthOf(2);
                done();
            });
    });

    it('should provide interface via /query_signature GET endpoint to query routes', function(done){
        chai.request(service)
            .get('/signature')
            .query({'account': '7df78ad890df'})
            .end(function(err, res){
                chai.should().equal(err, null);
                res.should.have.status(200);
                res.should.be.json;
                chai.should().exist(res.body.account);
                res.body.account.should.be.equal('7df78ad890df');
                chai.should().exist(res.body.updated);
                chai.should().exist(res.body.created);
                chai.should().exist(res.body.signature);
                res.body.signature.should.be.equal('HASH');
                done();
            });
    });

});



