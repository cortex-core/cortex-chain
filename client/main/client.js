const axios = require("axios");

class ChainClient {

    query_task(req) {
        return axios.get(ChainClient.url + '/task', req);
    }

    query_signature(req) {
        return axios.get(ChainClient.url + '/signature', req);
    }
}

ChainClient.url = 'http://chain-machine:8080';

module.exports = ChainClient;