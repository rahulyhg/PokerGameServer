var schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    transType: {
        type: String,
        enum: ["diposit", "withdraw", "tableLost", "tableWon"]
    },
    amount: Number,
    status: String,
    transactionId: String,
    transactionLog: Schema.Types.Mixed,
    Voucher: String,
    balance: {
        type: Number,
        default: 0
    }
});

schema.plugin(deepPopulate, {});
schema.plugin(uniqueValidator);
schema.plugin(timestamps);
module.exports = mongoose.model('Transaction', schema);

var exports = _.cloneDeep(require("sails-wohlig-service")(schema));
var model = {
    getDetails: function (data, callback) {
        var Model = this;
        var pagination = 20;
        var page = 0;
        if (data.page) {
            page = data.page
        }
       console.log(data);
        var skipRecords = page * pagination;
        User.findOne({
            accessToken: data.accessToken
        }).exec(function (err, data) {
            if (err) {
                callback(err);
            } else {
                if (!_.isEmpty(data)) {
                    
                    var options = {
                       
                        
                        start: page  * pagination,
                        count: pagination
                    };

                     Model.find({
                         userId: data._id
                     }).sort({_id:-1}).page(options, callback);
                    // Model.find({
                    //             userId: data._id
                    //         }
                    //         // {
                    //         //     _id: 0,
                    //         //     transType: 1,
                    //         //     amount: 1,
                    //         //     status: 1,
                    //         // }
                    //     ).sort({
                    //         _id: -1
                    //     })
                    //     // .skip(skipRecords)
                    //     // .limit(pagination)
                    //     .exec(function (err, data) {
                    //         if (err) {
                    //             callback(err);
                    //         } else {

                    //             callback(err, data);
                    //         }
                    //     });
                }else{
                    callback("Please login first.");
                }
            }
        });
    },
    buyCoins: function (coinData, callback) {
        //console.log();
        var transData = {};
        //transData.transStatus = "Completed";
        transData.transType = 'diposit';
        console.log("coinData", coinData);
        //  transData.amount = coinData.coins;
        var transAmt = parseInt(coinData.coins);
        // var transAmt;
        var accessToken = coinData.accessToken;
        if (transAmt == NaN) {
            callback("Enter Valid Amount");
        }
        User.findOne({
            accessToken: accessToken
        }).exec((err, data) => {

            if (!_.isEmpty(data)) {

                var finalAmount = parseInt(data.balance) + parseInt(transAmt);
                //save the transaction
                transData.userId = data._id
                transData.amount = transAmt;
                transData.balance = finalAmount;
                //change the balance
                data.balance = finalAmount;
                async.parallel([(callback) => {
                    Transaction.saveData(transData, callback);
                }, function (callback) {
                    data.save(callback);
                }], function (err, result) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        callback(err, "Transaction Saved Successfully")
                    }
                });
            } else {
                callback("You need to login first.");
            }
        });
    },
    withdrawCoins: function (coinData, callback) {
        var transData = {};
        transData.transType = 'withdraw';
        var transAmt = parseInt(coinData.coins);
        var accessToken = coinData.accessToken;
        if (transAmt == NaN) {
            callback("Enter Valid Amount");
        }
        User.findOne({
            accessToken: accessToken
        }).exec(function (err, data) {

            if (!_.isEmpty(data)) {

                var finalAmount = parseInt(data.balance) - parseInt(transAmt);
                //save transaction                
                transData.userId = data._id
                transData.amount = transAmt;
                transData.balance = finalAmount;
                //change balance of user
                data.balance = finalAmount;
                async.parallel([function (callback) {
                    Transaction.saveData(transData, callback);
                }, function (callback) {
                    data.save(callback);
                }], function (err, result) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        callback(err, "Transaction Saved Successfully")
                    }
                });
            } else {
                callback("You need to login first.");
            }
        });
    },
    changeStatus: function (transData, callback) {

    },
    tableWonAmount: function (transData, callback) {
        var transData = {};
        var transStatus = "tableWon";
        var transAmt;
        var accessToken = data.accessToken;
        if (parseInt(transAmt) == NaN) {
            callback("Enter Valid Amount");
        }
        user.findOne({
            accessToken: accessToken
        }).exec(function (err, data) {

            if (!_.isEmpty(data)) {
                async.parallel({
                    transaction: function (callback) {
                        transData.userId = userData._id;
                        if (transData._id) {
                            Transaction.saveData(transData, function (err, data) {
                                callback(err, data);
                            });
                        } else {
                            Transaction.findOneAndUpdate({
                                userId: userData._id,
                                _id: data.transId
                            }, {
                                $inc: {
                                    amount: transAmt
                                }
                            });
                        }
                    },
                    balance: function (callback) {
                        var finalAmount = parseInt(data.amount) + parseInt(transAmt);
                        data.balance = finalAmount;
                        data.save(function (err, data) {
                            callback(err, data);
                        });
                    }
                }, function (err, result) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(err, {
                            tansId: result.transaction._id
                        })
                    }
                });
            } else {
                callback("You need to login first.");
            }
        });
    },
    tableLostAmount: function (data, callback) {
        var transData = {};
        //transData.transStatus = "tableLost";
        var transAmt = data.coins;
        transData.amount = transAmt;
        var accessToken = data.accessToken;
        if (parseInt(transAmt) == NaN) {
            callback("Enter Valid Amount");
        }
        transData.amount = coinData.coins;
        if (!_.isEmpty(data.transId)) {
            transData._id = data.transId;
        }
        user.findOne({
            accessToken: accessToken
        }).exec(function (err, userData) {

            if (!_.isEmpty(data)) {
                async.parallel({
                    transaction: function (callback) {
                        transData.userId = userData._id;
                        if (transData._id) {
                            Transaction.saveData(transData, function (err, data) {
                                callback(err, data);
                            });
                        } else {
                            Transaction.findOneAndUpdate({
                                userId: userData._id,
                                _id: data.transId
                            }, {
                                $inc: {
                                    amount: transAmt
                                }
                            });
                        }
                    },
                    balance: function (callback) {
                        var finalAmount = parseInt(data.amount) - parseInt(transAmt);
                        data.balance = finalAmount;
                        data.save(function (err, data) {
                            callback(err, data);
                        });
                    }
                }, function (err, result) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(err, {
                            transId: result.transaction._id
                        })
                    }
                });
            } else {
                callback("You need to login first.");
            }
        });
    }
};
module.exports = _.assign(module.exports, exports, model);