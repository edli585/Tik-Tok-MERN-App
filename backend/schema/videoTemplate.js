const mongoose = require('mongoose');

const vidSchema = mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please add the username']
    },
    url: {
        type: String,
        required: [true, 'Please add the url']
    },
    videoname: {
        type: String,
        required: [true, "Please add the video's name"]
    }
})

module.exports = mongoose.model('VideoInfo', vidSchema);