const express = require('express');
const dotenv = require('dotenv').config();
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const win = require('./pickWinner');

const VideoInfo = require('./schema/videoTemplate');
const VideoPref = require('./schema/prefTemplate');

const port = process.env.PORT || 5000;

//connect to database
connectDB();

let numVids = 0;
getVidCount().then((res) => numVids = res).catch((err) => console.log("Can't get video count:", err));
console.log("There are " + numVids + " videos");
let numCombos = calcNumCombo(numVids);

const app = express();

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    next();
});

//gets all videos from database
app.get('/getAllVideos', (req, res) => {
    getAllVideos()
    .then(result => {
        res.json(result);
    })
    .catch((err) => {
        console.log("Unable to get videos:", err);
        res.status(500).send("Cannot get videos:", err);
    });
});

//insert video info into the database
app.post('/videoData', (req, res) => {
    if(!req.body) {
        console.log("Bad request");
        res.status(400).send("Bad request");
    }
    
    VideoInfo.findOne({url: req.body.url})
    .then((result) => {
        if(result !== null) res.status(200).send({msg: "Video already exists"});
        else {
            VideoInfo.create({
                username: req.body.username,
                url: req.body.url,
                videoname: req.body.videoname
            }).then(() => {
                numVids++;
                numCombos = calcNumCombo(numVids);
                res.status(200).send({msg: "Video Submitted!"})
            }).catch((err) => {
                console.log(err);
                res.status(500).send({msg: "Can't insert video " + err});
            });
        }
    })
    .catch((err) => {
        console.log(err);
        res.status(500).send({msg: "Error with database: " + err});
    });
});

//get the video that was just insert from the database
app.get('/getMostRecentVid', (req, res) => {
    if(!req.body) {
        console.log("Bad request");
        res.status(400).send("Bad request");
    }
    VideoInfo.find({}).sort({_id:-1}).limit(1)
    .then((result) => {
        res.status(200).json(result);
    })
    .catch((err) => {
        res.status(500).send("Can't find video:", err);
    })
});

//delete video from page and database and move everything else accordingly
//and also delete pref of video
app.post('/deleteVideo', (req, res) => {
    if(!req.body) {
        console.log("Bad request");
        res.status(400).send("Bad request");
    }
    let id = req.body.id;
    console.log(id);
    VideoInfo.findById(id).then((result) => {
        console.log(result)
        VideoInfo.deleteOne(result).then(() => {
            res.status(200);
            VideoPref.deleteMany({better: ("" + id)})
            .then((count) => console.log("Succussfully deleted", count, "preferences"))
            .catch((err) => console.log("Couldn't delete preferences:", err));
            VideoPref.deleteMany({worse: ("" + id)})
            .then((count) => console.log("Succussfully deleted", count, "preferences"))
            .catch((err) => console.log("Couldn't delete preferences:", err));
            numVids--;
            numCombos = calcNumCombo(numVids);
            res.send({msg:"Successfully removed!"});
        }).catch((err) => {
            res.status(400);
            res.send("Can't remove video:", err);
        });
    })
    .catch((err) => {
        res.status(500).send("Can't delete video:", err);
    })
});

//pick two random videos to compare
app.get('/getTwoVideos', (req, res) => {
    getVidCount()
    .then((c) => {
        let pair = getPair(c);
        /*
        while(isInRecord(pair)) {
            pair = getPair(c);
        }
        */
        let x = pair[0], y = pair[1];
        getAllVideos()
        .then((vids) => {
            let data = {
                "first": vids[x],
                "second": vids[y]
            };
            /*
            if(!randRecord.has(x)) randRecord.set(x, new Set());
            randRecord.get(x).add(y);
            if(!randRecord.has(y)) randRecord.set(y, new Set());
            randRecord.get(y).add(x);
            */
            res.json(data);
        })
        .catch((err) => {
            console.log("Error:", err);
            res.status(500).send(err);
        });
    }).catch((err) => {
        console.log("Error:", err);
        res.status(500).send(err);
    })
});

//insert the preferences
app.post('/insertPref', (req, res) => {
    calcNumCombo();
    if(!req.body) {
        res.status(400);
        res.send({msg: "please enter a proper JSON"});
        throw new Error("Please enter a proper JSON")
    }
    let id1 = req.body.better, id2 = req.body.worse;
    
    hasVideo(id1).then((has1) => {
        if(has1 === false) {
            res.status(500).send({msg: "Can't find vid " + id1});
        }
        else {
            hasVideo(id2).then((has2) => {
                if(has2 === false) {
                    res.status(500).send({mgs: "Can't find vid " + id2});
                }
                else {
                    VideoPref.create({
                        better: id1,
                        worse: id2,
                    }).then(() => {
                        VideoPref.count()
                        .then((result) => {
                            if(result >= numCombos) 
                                res.status(200).send({msg: "winner"});
                            else 
                                res.status(200).send({msg: "continue"});
                        })
                        .catch((err) => {
                            console.log("Couldn't get number of preferences:", err);
                            res.status(500).send(err);
                        })
                    }
                    ).catch((err) => {
                        console.log("Couldn't insert preference:", err);
                        res.status(500).send(err);
                    });
                }
            }).catch((err) => {
                res.status(500).send({msg: "Can't find vid " + id1});
            });
        }
    }).catch((err) => {
        res.status(500).send({msg: "Can't find vid " + id2});
    });
});

//See if there are enough preferences to compute a winner
app.get('/canCalcWinner', async (req, res) => {
    getPrefCount()
    .then((count) => {
        //console.log(count, 'prefs');
        res.status(200);
        res.send((count >= numCombos) ? {msg: 'continue'}: {msg: 'unable'})
    })
    .catch((err) => {
        res.status(500);
        res.send({msg: err});
    });
});

//output most preferred video
app.get('/getWinner', async (req, res) => {
    try {
        let winner = await win.computeWinner(numVids);
        VideoInfo.findById(winner)
        .then((result) => {
            res.json(result);
        })
        .catch((err) => {
            console.log("Error:", err);
            res.status(500).send("Couldn't get winner:", err);
        })
    }
    catch(err) {
        console.log("Error:", err);
        res.status(500).send(err);
    }
});

if(process.env.NODE_ENV === 'production') {
    console.log('Using production build')
    app.use(express.static(path.join(__dirname, '../client/build')))

    app.get('*', async (req, res) => {
        res.sendFile(path.resolve(__dirname, '../', 'client', 'build', 'index.html'))
    })
}
else {
    console.log('In development build')
    app.get('/', (req, res) => res.send('Please set to production'))
}

app.use((req, res) => {
    res.status(404);
    res.type('text');
    res.send('404 - File' + req.url + ' not found');
});

app.listen(port, () => console.log(`Server started on port ${port}`));

//returns number of video entries from database
async function getVidCount() {
    let n = await VideoInfo.count();
    return n;
}

//returns number of user preferences from database
async function getPrefCount() {
    let n = await VideoPref.count();
    return n;
}

//returns collection of video entries from database
async function getAllVideos() {
    let vids = await VideoInfo.find();
    return vids;
}

//generates random int from 0 - max
function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

//generates random pair
function getPair(max) {
    let x = getRandomInt(max);
    let y = getRandomInt(max);
    while(x === y) y = getRandomInt(max);
    return [x, y];
}

//checks if the pair is contained in the map
/*
function isInRecord(pair) {
    let x = pair[0], y = pair[1];
    if(!randRecord.has(x) || !randRecord.has(y)) return false;
    return randRecord.get(x).has(y) && randRecord.get(y).has(x);
}
*/

async function hasVideo(id) {
    let vid = await VideoInfo.findById(id);
    return vid != null;
}

//calculate number of pairs before computing winner
function calcNumCombo() {
    getVidCount()
    .then((result) => {
        numCombos = Math.floor((result * (result - 1))/4);
    })
    .catch((err) => {
        console.log("Can't get number of entries in database:", err);
    });
};