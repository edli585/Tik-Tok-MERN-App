let Pagerank = require('pagerank-js');
const util = require('util');
Pagerank = util.promisify(Pagerank);

const connectDB = require('./config/db');

connectDB();
const VideoInfo = require('./schema/videoTemplate');
const VideoPref = require('./schema/prefTemplate');

async function computeWinner(n) {
    let keyList = await getAllVidIds();
    let prefs = await getAllPrefs();
    
    let nodes = makeDirectedGraph(prefs, n, keyList);
    let linkProb = 0.85;
    let tolerance = 0.0001;

    let results = await Pagerank(nodes, linkProb, tolerance);
    //console.log(results);
    let i = results.indexOf(Math.max(...results));

    return keyList[i];
};

function makeDirectedGraph(prefs, n, keylist) {
    let graph = {};
    for(let i = 0; i < keylist.length; i++) {
        graph[keylist[i]] = [];
    }

    for(let i = 0; i < prefs.length; i++) {
        let b = prefs[i].better;
        let w = prefs[i].worse;
        graph[w].push(b);
    }

    let translate = {};
    for(let i = 0; i < keylist.length; i++) {
        translate[keylist[i]] = i;
    }

    const adjList = [];
    for(let i = 0; i < keylist.length; i++) {
        let key = keylist[i];
        let outgoing = graph[key];
        let newoutgoing = outgoing.map((x) => translate[x]);
        adjList.push(newoutgoing);
    }
    return adjList;
};

async function getAllVidIds() {
    let vids = await VideoInfo.find();
    let idList = [];
    vids.forEach((vid) => {
        idList.push(vid._id.valueOf());
    })
    return idList;
};

async function getAllPrefs() {
    let prefs = await VideoPref.find();
    return prefs;
};

module.exports = {
    computeWinner: computeWinner
}