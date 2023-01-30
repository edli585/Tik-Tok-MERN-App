const mongoose = require('mongoose');
const prefSchema = mongoose.Schema({
    better: {
        type: String,
        required: [true, 'Please add which is better']
    },
    worse: {
        type: String,
        required: [true, 'Please add which is worse']
    },
})

module.exports = mongoose.model('VideoPref', prefSchema);