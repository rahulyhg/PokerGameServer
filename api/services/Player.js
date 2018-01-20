var schema = new Schema({
    playerNo: {
        type: Number,
        required: true,
        //        unique: true,
        // excel: true,
    },
    isTurn: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isFold: {
        type: Boolean,
        default: false
    },
    isDealer: {
        type: Boolean,
        default: false
    },
    cards: [String],
    cardsServe: {
        type: Number,
        default: 0
    },
    isLastBlind: {
        type: Boolean,
        default: false
    },

    isAllIn: {
        type: Boolean,
        default: false
    },
    hasChecked: {
        type: Boolean,
        default: false
    },
    hasCalled: {
        type: Boolean,
        default: false
    },
    table: {
        type: Schema.Types.ObjectId,
        ref: 'Player'
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    isBigBlind: {
        type: Boolean,
        default: false
    },
    isSmallBlind: {
        type: Boolean,
        default: false
    },
    hasTurnCompleted: {
        type: Boolean,
        default: false
    },
    buyInAmt: {
        type: Number,
        default: 0
    },
    socketId: {
        type: String,
        required: true
    },
    hasRaised: {
        type: Boolean,
        default: false
    }
});
schema.plugin(deepPopulate, {
    populate: {
        'cards': {
            select: 'name _id'
        },
        'user': {
            select: 'balance'
        }
    }
});
schema.plugin(uniqueValidator);
schema.plugin(timestamps);
module.exports = mongoose.model('Player', schema);
var exports = _.cloneDeep(require("sails-wohlig-service")(schema, "cards user", "cards user"));

var model = {
    addPlayer: function (data, callback) {
        Player.saveData(data, function (err, data2) {
            if (err) {
                callback(err, data2);
            } else {
                data3 = data2.toObject();
                delete data3.password;
                callback(err, data3);
            }
        });
    },
    updatePlayer: function (data, callback) {

        var playerData = _.clone(data, true);
        delete playerData.playerNo;
        Player.update({
            "playerNo": data.playerNo
        }, playerData, {
            new: true,
            runValidators: true
        }, function (err, doc) {
            if (err) {
                callback(err);
            } else {
                callback(err, doc);
            }
        });
    },
    deletePlayer: function (data, callback) {
        Player.findOne({
            "playerNo": data.playerNo
        }).exec(function (err, userData) {
            if (!_.isEmpty(userData)) {
                userData.remove(function (err, data) {
                    callback(err, "Deleted successfully");
                });
            } else {
                callback(err, userData);
            }
        });
    },
    findWinner: function (data, callback) {
        Player.find().exec(function (err, userData) {
            callback(err, userData);
        });
    },
    getAll: function (data, callback) {
        var cards = {};
        async.parallel({
            playerCards: function (callback) {
                Player.find({}, {
                    playerNo: 1,
                    isTurn: 1,
                    isActive: 1,
                    isDealer: 1,
                    isFold: 1,
                    cards: 1,
                    isAllIn: 1,
                    hasRaised: 1,
                    hasCalled: 1,
                    hasChecked: 1,
                    isLastBlind: 1,
                    hasRaisedd: 1,
                    _id: 0
                }).exec(callback);
            },
            communityCards: function (callback) {
                CommunityCards.find({}, {
                    cardNo: 1,
                    cardValue: 1,
                    isOpen: 1,
                    isBurn: 1,
                    _id: 0
                }).exec(callback);
            }
        }, function (err, data) {
            if (err) {
                callback(err);
            } else {
                var turnPlayer = _.find(data.playerCards, function (player) {
                    return player.isTurn;
                });
                var raiseIndex = _.findIndex(data.playerCards, function (player) {
                    return player.hasRaised;
                });
                var lastBlindIndex = _.findIndex(data.playerCards, function (player) {
                    return player.isLastBlind;
                });
                var blankCardIndex = _.findIndex(data.communityCards, function (card) {
                    return card.cardValue === "";
                });

                if (turnPlayer) {
                    data.hasTurn = true;
                    if (raiseIndex < 0 && lastBlindIndex < 0) {
                        data.isCheck = true;
                    }
                    if (turnPlayer.isLastBlind && turnPlayer.isTurn) {
                        data.isCheck = true;
                    }
                } else {
                    data.hasTurn = false;
                    if (blankCardIndex < 0) {
                        data.showWinner = true;
                    }
                }
                callback(err, data);
            }
        });
    },
    getTabDetail: function (data, callback) {
        async.parallel({
            playerCards: function (callback) {
                Player.find({
                    playerNo: data.tabId
                }, {
                    playerNo: 1,
                    isTurn: 1,
                    isActive: 1,
                    isDealer: 1,
                    isFold: 1,
                    cards: 1,
                    _id: 0
                }).exec(callback);
            },
            communityCards: function (callback) {
                CommunityCards.find({}, {
                    cardNo: 1,
                    cardValue: 1,
                    isOpen: 1,
                    _id: 0
                }).exec(callback);
            }
        }, callback);

    },
    showWinner: function (data, callback) {
        console.log("inside showwinner");
        console.log(data);
        var tableId = data.tableId;
        async.parallel({
            players: function (callback) {
                Player.find({
                    table: data.tableId,
                    isActive: true,
                    isFold: false
                }).lean().exec(callback);
            },
            communityCards: function (callback) {
                CommunityCards.find({
                    table: data.tableId,
                    isBurn: false,
                    cardValue: {
                        $nin: ["", " ", null]
                    }
                }).lean().exec(callback);
            },
            pots: function (callback) {
                Pot.find({
                    table: data.tableId
                }).exec(callback);
            }
        }, function (err, data) {
            if (err) {
                callback(err);
            } else {
                console.log("data", data);
                Pot.declareWinner(data, function (err, data1) {
                    if (err) {
                        callback(err);
                    } else {
                        Table.blastSocketWinner(tableId);
                        CommunityCards.setNewGameTimeOut(tableId);
                        callback();
                    }
                });
                //Check All Player Cards are Placed
                // CommunityCards.findWinner(data.players, data.communityCards, function (err, finalVal) {
                //     if (err) {
                //         callback(err);
                //     } else {
                //         Player.blastSocketWinner({
                //             winners: data.players,
                //             communityCards: data.communityCards
                //         });
                //         callback(null, {
                //             winners: data.players,
                //             communityCards: data.communityCards
                //         });
                //     }
                // });

            }
        });
    },
    revealCards: function (data, callback) {
        CommunityCards.find({
            isOpen: true
        }).exec(function (err, cardsData) {
            var revealNo = cardsData.length;
            switch (revealNo) {
                case 0:
                    CommunityCards.update({
                        cardNo: {
                            $lt: 4
                        }
                    }, {
                        $set: {
                            isOpen: true
                        }
                    }, {
                        multi: true
                    }, function (err, data) {
                        Player.blastSocket();
                        callback(err, data);
                    });
                    break;
                case 3:
                    CommunityCards.update({
                        cardNo: 4
                    }, {
                        $set: {
                            isOpen: true
                        }
                    }, {
                        multi: true
                    }, function (err, data) {
                        Player.blastSocket();
                        callback(err, data);
                    });
                    break;
                case 4:
                    CommunityCards.update({
                        cardNo: 5
                    }, {
                        $set: {
                            isOpen: true
                        }
                    }, {
                        multi: true
                    }, function (err, data) {
                        Player.blastSocket();
                        callback(err, data);
                    });
                    break;
                default:
                    callback(null, "No more cards to reveal");
            }
        });
    },
    getPlayer: function (data, callback) {
        if (data.accessToken == 'fromSystem') {
            callback(null);
            return 0;
        }
        var pipeLine = [{
                $match: {
                    "accessToken": data.accessToken
                }
            },
            {
                $lookup: {
                    "from": "players",
                    "localField": "_id",
                    "foreignField": "user",
                    "as": "player"
                }
            }
        ]

        User.aggregate(pipeLine, function (err, userData) {

            if (err) {
                callback(err);
            } else {
                if (_.isEmpty(userData[0])) {

                    callback("Please Login First To Continue.");
                } else {
                    console.log("inside get Player", userData[0].player);
                    if (_.isEmpty(userData[0].player)) {
                        callback("Not Registered as a Player.");
                    } else {
                        Player.currentTurn(data.tableId, function (err, player) {
                            console.log("player   ", player);
                            if (err || _.isEmpty(player)) {
                                callback(err);
                            } else {
                                var requestedPlayer = _.find(userData[0].player, function (p) {
                                    return p.table == data.tableId
                                });
                                if (requestedPlayer && player._id + "" == requestedPlayer._id + "") {
                                    callback(err, player)
                                } else {
                                    callback("Invalide Request");
                                }
                            }
                        });

                    }
                }
            }
        });
    },
    getAllDetails: function (data, callback) {
        var tableId = data.tableId;
        var requiredData = Player.requiredData();
        async.parallel({
            players: function (callback) {
                Player.find({
                    table: tableId
                }, requiredData.player).lean().exec(callback);
            },
            communityCards: function (callback) {
                CommunityCards.find({
                    table: tableId
                }, requiredData.communityCards).sort({
                    cardNo: 1
                }).exec(callback);
            },
            pots: function (callback) {
                Pot.find({
                    table: tableId
                }, requiredData.pot).sort({
                    _id: 1
                }).lean().exec(callback);
            },
            table: function (callback) {
                Table.findOne({
                    _id: tableId
                }, requiredData.table).exec(callback);
            },
            extra: function (callback) { //to have same format required by the frontend
                callback(null, {});
            }
        }, function (err, allData) {
            if (err) {
                callback(err);
            } else {
                _.each(allData.pots, function (p, key) {
                    p['no'] = key + 1;
                });

                _.each(allData.players, function (p) {
                    allData.players.winPots = [];
                    _.each(allData.pots, function (pot) {
                        var winIndex = -1
                        if (pot.winner && !_.isEmpty(pot.winner)) {
                            winIndex = _.findIndex(pot.winner, function (w) {
                                return w.winner && w.playerNo == p.playerNo;
                            });
                            if (winIndex >= 0) {
                                allData.players.winPots.push(p.no);
                            }
                            _.remove(pot.winner, function (w) {
                                return !pot.winner
                            });
                        }
                    })


                });
                Pot.solveInfo(allData, function (err, data) {
                   // console.log("inside allData");
                    if (err) {
                        console.log("inside allData err", err);
                        callback(null, allData);
                    } else {

                        if (!_.isEmpty(data.currentPlayer)) {

                            //enable or disable buttons depending on conditions
                            var totalRoundAmount = 0;
                            var remainingBalance = data.currentPlayer.buyInAmt - data.currentPlayer.totalAmount;
                            allData.isChecked = false;
                            allData.isCalled = false;
                            allData.isRaised = false;
                            allData.fromRaised = 0;
                            allData.toRaised = 0;
                            if (data.callAmount <= 0) {
                                allData.isChecked = true;
                            }

                            _.each(data.pots, function (p) {
                                totalRoundAmount += p.potMaxLimit;
                            });

                            allData.fromRaised = totalRoundAmount - data.currentPlayer.totalAmount + 100;

                            if (remainingBalance >= allData.fromRaised) {
                                allData.isRaised = true;
                            }

                           // console.log("remainingBalance", remainingBalance);
                           // console.log("data.payableAmt", data.payableAmt);
                            if (remainingBalance >= data.callAmount && !allData.isChecked) {
                                allData.isCalled = true;
                            }

                            allData.toRaised = remainingBalance;

                            if (allData.toRaised > data.allInAmount) {
                                allData.toRaised = data.allInAmount;
                            }
                            // allData.isRaised = true;
                            delete allData.tableStatus;
                            delete allData.currentPlayer;
                            delete allData.callAmount;
                            delete allData.allInAmount;
                            callback(null, allData);
                        } else {
                            callback(null, allData);
                        }
                    }

                });
            }
            //send isckecked and raise amount( from to end)   
        });
    },
    newGame: function (data, callback) {
        var Model = this;
        var tableId = data.tableId;
        async.waterfall([
                function (callback) {
                    GameLogs.flush(function (err, data) {
                        callback(err);
                    });
                },
                function (callback) {
                    Player.makeDealer(data, function (err, data) {
                        console.log(err);
                        callback(err);
                    });
                },

                // function (callback) { // Next Dealer
                //     Model.find({
                //         table: tableId,
                //         isActive: true
                //     }).exec(function (err, players) {
                //         if (err) {
                //             callback(err);
                //         } else {
                //             var turnIndex = _.findIndex(players, function (n) {
                //                 return n.isDealer;
                //             });
                //             callback();
                //             // if (turnIndex >= 0) {
                //             //     async.parallel({
                //             //         removeDealer: function (callback) {
                //             //             var player = players[turnIndex];
                //             //             player.isDealer = false;
                //             //             player.save(callback);
                //             //         },
                //             //         addDealer: function (callback) {
                //             //             var newTurnIndex = (turnIndex + 1) % players.length;
                //             //             var player = players[newTurnIndex];
                //             //             player.isDealer = true;
                //             //             player.save(callback);
                //             //         }
                //             //     }, function (err, data) {
                //             //         callback();
                //             //     });
                //             // } else {
                //             //     callback("No Element Remaining");
                //             // }
                //         }
                //     });
                // },
                function (fwCallback) {
                    console.log(fwCallback);
                    Model.find({
                        table: tableId
                    }).exec(function (err, players) {
                        if (err) {
                            callback(err);
                        } else {
                            async.each(players,
                                function (p, callback) {
                                    var buyInAmt = p.buyInAmt - p.totalAmount;
                                    Model.update({
                                        table: tableId,
                                        _id: p._id
                                    }, {
                                        $set: {
                                            isFold: false,
                                            cards: [],
                                            isTurn: false,
                                            cardsServe: 0,
                                            isLastBlind: false,
                                            hasRaised: false,
                                            isAllIn: false,
                                            hasRaisedd: false,
                                            hasChecked: false,
                                            hasCalled: false,
                                            isSmallBlind: false,
                                            isBigBlind: false,
                                            totalAmount: 0,
                                            hasTurnCompleted: false,
                                            isActive: true,
                                            buyInAmt: buyInAmt
                                        },

                                    }, {
                                        multi: true
                                    }, callback);

                                }, fwCallback);
                        }
                    });
                },
                function (fwCallback) {
                    CommunityCards.update({
                        table: tableId
                    }, {
                        $set: {
                            cardValue: "",
                            isOpen: false,
                            serve: false
                        }
                    }, {
                        multi: true
                    }, function (err, cumCards) {
                        fwCallback(err);
                    });
                },
                function (callback) {
                    Pot.remove({
                        table: tableId
                    }, function (err, data) {
                        console.log("err", err);
                        callback(err)
                    })
                },
                function (callback) {
                    Table.update({
                        _id: tableId
                    }, {
                        status: "beforeStart",
                        activePlayer: []
                    }).exec(function (err, data) {
                        console.log("err", err);
                        callback(err);
                    });
                },
                function (callback) {
                    Player.remove({
                        table: tableId
                    }, callback);
                }
            ],
            function (err, cumCards) {
                Table.blastNewGame(tableId, {
                    newGame: true
                });
                console.log("final, err");
                callback(err, cumCards);
            });
        readLastValue = "";
        cardServed = false;
    },
    makeDealer: function (data, callback) {
        var Model = Player;
        console.log("make dealer", data);
        async.waterfall([
            function (callback) {
                Player.update({
                    table: data.tableId
                }, {
                    $set: {
                        isActive: true,
                        isDealer: false
                    }
                }, {
                    multi: true
                }, callback);
            },
            function (val, callback) {
                Player.findOne({
                    isActive: true,
                    table: data.tableId,
                    isDealer: true
                }).exec(callback);
            },
            function (dealer, callback) {
                Player.find({
                    isActive: true,
                    table: data.tableId
                }).sort({
                    playerNo: 1
                }).exec(function (err, players) {
                    if (err || _.isEmpty(players)) {
                        callback(err);
                    } else {
                        if (!_.isEmpty(dealer)) {
                            var playerIndex = _.findIndex(players, function (player) {
                                return player.playerNo == dealer.playerNo;
                            });
                            if (playerIndex >= 0) {
                                async.parallel({
                                    startServe: function (callback) {
                                        CommunityCards.startServe(data.tableId, callback);
                                    },
                                    addDealer: function (callback) {
                                        players[playerIndex].isDealer = true;
                                        players[playerIndex].save(callback);
                                    },
                                    addBlind: function (callback) {
                                        var skipBlind = 2;
                                        if (data.isStraddle) {
                                            skipBlind = 3;
                                        }
                                        var turnIndex = (playerIndex + skipBlind) % players.length;
                                        players[turnIndex].isLastBlind = true;
                                        players[turnIndex].save(callback);
                                    }
                                }, function (err, data1) {
                                    Table.blastSocket(data.tableId);
                                    callback(err, data);
                                });
                            } else {
                                callback("No Such Player");
                            }
                        } else {
                            async.parallel({
                                startServe: function (callback) {
                                    CommunityCards.startServe(data.tableId, callback);
                                },
                                makeDealer: function (callback) {
                                    players[0].isDealer = true;
                                    players[0].save(function (err, data) {
                                        console.log(err);
                                        callback(err);
                                    });
                                }
                            }, callback);

                        }
                    }
                });
            }
        ], callback);
    },
    removeDealer: function (data, callback) {
        var Model = this;
        Model.findOneAndUpdate({
            playerNo: data.tabId
        }, {
            $set: {
                isDealer: false
            }
        }, {
            new: true
        }, function (err, CurrentTab) {
            callback(err, CurrentTab);
        });
    },
    removeTab: function (data, callback) {
        var Model = this;
        Model.findOneAndUpdate({
            playerNo: data.tabId
        }, {
            $set: {
                isActive: false
            }
        }, {
            new: true
        }, function (err, currentTab) {
            Player.blastSocket();
            callback(err, currentTab);
        });
    },
    addTab: function (data, callback) {
        var Model = this;
        Model.findOneAndUpdate({
            playerNo: data.tabId
        }, {
            $set: {
                isActive: true
            }
        }, {
            new: true
        }, function (err, CurrentTab) {
            Player.blastSocket();
            callback(err, CurrentTab);
        });
    },
    assignCard: function (card, wfCallback) {
        var Model = this;
        Model.findOneAndUpdate({
            isTurn: true,
            cardsServe: {
                $lt: 2
            }
        }, {
            $push: {
                cards: card
            },
            $inc: {
                cardsServe: 1
            }
        }, {
            new: true
        }, function (err, CurrentTab) {
            if (!_.isEmpty(CurrentTab)) {
                readLastValue = card;
                wfCallback(err, CurrentTab);
            } else {
                //$nin    
                CommunityCards.findOneAndUpdate({
                    $or: [{
                        cardValue: {
                            $in: ["", undefined, null]
                        }
                    }, {
                        cardValue: {
                            $exists: false
                        }
                    }]
                }, {
                    cardValue: card
                }, {
                    new: true,
                    sort: {
                        cardValue: 1
                    }
                }, function (err, CurrentTab) {
                    readLastValue = card;
                    if (!_.isEmpty(CurrentTab)) {
                        if (CurrentTab.cardNo == 5) {
                            cardServed = true;
                            Model.changeTurnWithDealer(wfCallback);
                        } else {
                            wfCallback(err, CurrentTab);
                        }
                    } else {
                        wfCallback(err, "Extra Card");
                    }

                    //callback(null, "Repeated Card"); 
                });
            }
        });
    },
    checkDealer: function (tableId, callback) {
        Player.findOne({
            isActive: true,
            table: tableId,
            isDealer: true
        }).exec(callback);
    },
    serveCard: function (data, callback) {
        CommunityCards.checkServe(data.tableId, function (err, dataserve) {
            if (err) {
                callback(err);
            } else {

                if (dataserve && dataserve.serve) {

                    if (data.card && data.card.length == 2) {
                        var tableId = data.tableId;
                        async.parallel({
                            players: function (callback) {
                                Player.find({
                                    isActive: true,
                                    table: tableId
                                }).sort({
                                    playerNo: 1
                                }).exec(callback);
                            },
                            communityCards: function (callback) {
                                CommunityCards.find({
                                    table: tableId
                                }).sort({
                                    cardNo: 1
                                }).exec(callback);
                            },
                            table: function (callback) {
                                Table.find({
                                    _id: tableId
                                }).exec(callback);
                            }
                        }, function (err, response) {
                            console.log(response);
                            // Initialize all variables
                            var allCards = [];
                            var playerCards = [];
                            var playerCount = response.players.length;
                            var communityCards = [];
                            var communityCardCount = 0;
                            var dealerNo = -1;
                            var maxCommunityCard = 8;
                            var maxCardsPerPlayer = 2;

                            _.each(response.players, function (player, index) {
                                playerCards = _.concat(playerCards, player.cards);
                                if (player.isDealer) {
                                    dealerNo = index;
                                }
                            });

                            _.each(response.communityCards, function (commuCard) {
                                if (commuCard.cardValue && commuCard.cardValue !== "") {
                                    communityCards = _.concat(communityCards, commuCard.cardValue);
                                }
                            });
                            communityCardCount = communityCards.length;
                            allCards = _.concat(communityCards, playerCards);


                            // check whether no of players are greater than 1
                            if (playerCount <= 1) {
                                callback("Less Players - No of Players selected are too less");
                                return 0;
                            }

                            // check whether dealer is provided or not
                            if (dealerNo < 0) {
                                callback("Dealer is not selected");
                                return 0;
                            }

                            // Check whether Card is in any Current Cards List
                            var cardIndex = _.indexOf(allCards, data.card);
                            if (cardIndex >= 0) {
                                callback("Duplicate Entry - Card Already Used");
                                return 0;
                            }

                            if (playerCards.length < (playerCount * maxCardsPerPlayer)) {
                                // Add card to Players
                                var remainder = playerCards.length % playerCount;
                                var toServe = (dealerNo + remainder + 1) % playerCount;
                                var toServePlayer = response.players[toServe];
                                toServePlayer.cards.push(data.card);
                                toServePlayer.save(function (err, data) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(err, "Card Provided to Player " + response.players[toServe].playerNo);
                                        if (playerCards.length + 1 == (playerCount * maxCardsPerPlayer)) {
                                            console.log("Last Card Served");

                                            //table.status = 'preFlop';
                                            async.parallel([
                                                function (callback) {
                                                    Player.makeTurn("LastPlayerCard", tableId, function (err, data) {
                                                        callback(err, data);
                                                    });
                                                },
                                                function (callback) {
                                                    Table.updateStatus(tableId, callback)
                                                }
                                                // function (callback) {
                                                //     Table.findOneAndUpdate({
                                                //         _id: tableId
                                                //     }, {
                                                //         status: 'preFolp'
                                                //     }).exec(function (err, data) {
                                                //         callback(err, data);
                                                //     });
                                                // }
                                            ], function (err, data) {
                                                console.log("blast the socket");
                                                console.log("extra data", {
                                                    player: true,
                                                    value: response.players[toServe].playerNo
                                                });
                                                Table.blastSocket(tableId, {
                                                    player: true,
                                                    value: response.players[toServe].playerNo
                                                });
                                                //  callback(err, data);
                                            });
                                            // Player.makeTurn("LastPlayerCard", function (err, data) {
                                            //     Player.blastSocket({
                                            //         player: true,
                                            //         value: response.players[toServe].playerNo
                                            //     });
                                            // });
                                        } else if (playerCards.length == 0) {
                                            //var table = {};
                                            //table._id = tableId;
                                            //table.status = 'serve';
                                            Table.updateStatus(tableId, function (err, data) {
                                                Table.blastSocket(tableId, {
                                                    player: true,
                                                    value: response.players[toServe].playerNo
                                                });
                                            });
                                        } else {
                                            Table.blastSocket(tableId, {
                                                player: true,
                                                value: response.players[toServe].playerNo
                                            });
                                        }
                                    }
                                });
                            } else if (communityCardCount < maxCommunityCard) {
                                // Add card to Community Cards
                                var toServeCommuCard = response.communityCards[communityCardCount];
                                toServeCommuCard.cardValue = data.card;
                                toServeCommuCard.save(function (err, data) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        //communityCardCount++;
                                        callback(err, "Card Provided to Community Card No " + (communityCardCount));

                                        if (communityCardCount == 3 || communityCardCount == 5 || communityCardCount == 7) {
                                            Player.makeTurn(communityCardCount, tableId, function (err, data) {
                                                Table.blastSocket(tableId, {
                                                    player: false,
                                                    community: true,
                                                    value: communityCardCount
                                                });
                                            });
                                        } else {
                                            Table.blastSocket(tableId, {
                                                player: false,
                                                community: true,
                                                value: communityCardCount
                                            });
                                        }
                                    }
                                });
                            } else {
                                callback("All Cards are Served");
                                return 0;
                            }
                        });
                    } else {
                        callback("Incorrect Card - Please enter a valid Card");
                        return 0;
                    }

                } else {
                    callback(dataserve);
                }
            }

        });
    },
    serve: function (data, callback) {
        console.log(data);
        // CommunityCards.checkServe(data.tableId, function (err, dataserve) {
        //     if (err) {
        //         callback(err);
        //     } else {
        Player.checkDealer(data.tableId, function (err, dealer) {
            if (err || _.isEmpty(dealer)) {
                Player.makeDealer(data, function (err, dealer) {
                    if (err) {
                        callback(err);
                    } else {
                        Player.serveCard(data, callback);
                    }
                });
            } else {
                Player.serveCard(data, callback);
            }
        });

        //  }
        // });

    },
    blastSocket: function (data, fromUndo) {
        Player.getAll({}, function (err, allData) {
            if (!fromUndo) {
                GameLogs.create(function () {});
            } else {
                allData.undo = true;
            }
            if (data && data.newGame) {
                allData.newGame = true;
            }

            if (err) {
                console.log(err);
            } else {
                if (data) {
                    allData.extra = data;
                } else {
                    allData.extra = {};
                }
                sails.sockets.blast("Update", allData);
            }
        });
    },
    blastSocketWinner: function (data) {
        var newWinner = _.filter(data.winners, function (n) {
            return n.winner;
        });
        var finalWinner = _.map(newWinner, function (n) {
            var obj = {
                cards: n.cards,
                descr: n.descr,
                playerNo: n.playerNo
            };
            return obj;
        });
        sails.sockets.blast("ShowWinner", {
            data: finalWinner
        });
    },
    allIn: function (data, callback) {
        var tableId = data.tableId;
        Player.getPlayer(data, function (err, data) {
            if (err) {
                callback(err);
            } else {
                async.waterfall([
                    function (callback) { // Remove All raise
                        Player.update({}, {
                            $set: {
                                hasRaised: false,
                                isLastBlind: false,
                                hasCalled: false,
                                hasChecked: false,
                                hasRaisedd: false
                            }
                        }, {
                            multi: true
                        }, function (err, cards) {
                            callback(err, tableId);
                        });
                    },
                    Player.currentTurn,
                    function (player, callback) {
                        player.isAllIn = true;
                        player.hasRaised = true;
                        player.save(function (err, data) {
                            console.log("playerData", data);
                            callback(err, data);
                        });
                    },
                    function (player, callback) {
                        // console.log("callback", callback);
                        Pot.solvePot(player, 'allIn', 0, function (err, data) {
                            callback(err);
                        });
                    },
                    function (callback) {
                        Player.changeTurn(tableId, callback);
                    }
                ], callback);
            }
        });
    },
    currentTurn: function (tableId, callback) {
        console.log("tableId", tableId);
        Player.findOne({
            table: tableId,
            isTurn: true
        }).exec(function (err, data) {
            if (err) {
                callback(err);
            } else if (_.isEmpty(data)) {
                console.log("No Player Has Turn");
                callback("No Player Has Turn");
            } else {
                console.log(data);
                callback(null, data);
            }
        });
    },
    changeTurn: function (tableId, callback) {
        async.waterfall([
            function (callback) {
                Player.currentTurn(tableId, callback);
            },
            function (playerFromTop, callback) {
                Player.find({
                    $or: [{
                        table: tableId,
                        isActive: true,
                        isFold: false,
                        isAllIn: false
                    }, {
                        table: tableId,
                        isTurn: true
                    }]
                }).sort({
                    playerNo: 1
                }).exec(function (err, players) {
                    if (err) {
                        callback(err);
                    } else {
                        var turnIndex = _.findIndex(players, function (n) {
                            return (n._id + "") == (playerFromTop._id + "");
                        });
                        if (turnIndex >= 0) {
                            async.parallel({
                                removeTurn: function (callback) {
                                    var player = players[turnIndex];
                                    player.hasTurnCompleted = true;
                                    player.isTurn = false;
                                    player.save(callback);
                                },
                                addTurn: function (callback) {
                                    var newTurnIndex = (turnIndex + 1) % players.length;
                                    var player = players[newTurnIndex];
                                    // player.turn = true;
                                    player.isTurn = true;
                                    CommunityCards.setTimeOut(tableId, player.playerNo);
                                    player.save(callback);
                                }
                            }, function (err, data) {
                                callback(err, data);
                                Player.whetherToEndTurn(data.removeTurn[0], data.addTurn[0], function (err) {
                                    Table.blastSocket(tableId);
                                });
                            });
                        }
                    }
                });

            }
        ], callback);
    },
    makeTurn: function (cardNo, tableId, callback) {
        var findInitialObj = {};
        Player.find({
            table: tableId,
            isActive: true,
            isFold: false,
            isAllIn: false
        }).exec(function (err, data) {
            if (err) {
                callback(err);
            } else {
                if (data.length > 1) {
                    async.waterfall([
                        function (callback) {
                            Player.update({
                                table: tableId
                            }, {
                                $set: {
                                    hasRaised: false,
                                    isTurn: false,
                                    hasChecked: false,
                                    hasCalled: false
                                }
                            }, {
                                multi: true
                            }, function (err, cards) {
                                callback(err);
                            });
                        },
                        function (callback) { // There is an MAIN Error where there is no dealer or No isLastBlind
                            if (cardNo == "LastPlayerCard") {
                                Table.findOne({
                                    _id: tableId
                                }, function (err, table) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        async.waterfall([
                                            function (callback) {
                                                CommunityCards.closeServe(tableId, function (err, data) {
                                                    callback(err, {
                                                        table: tableId,
                                                        type: 'main'
                                                    });
                                                });
                                            },

                                            Pot.createPot,
                                            //Player.findLastBlindNext(tableId, callback);
                                            Player.findDealerNext,
                                            Player.makeSmallBlind,
                                            Player.nextInPlay,
                                            Player.makeBigBlind,
                                            Player.nextInPlay,
                                            function (player, callback) {
                                                console.log("table.isStraddle", table.isStraddle);
                                                if (table.isStraddle) {
                                                    console.log("inside Straddle", table.isStraddle);
                                                    var pot = {};
                                                    pot.round = 'preFlop';
                                                    pot.amount = parseInt(table.bigBlind) * 2;
                                                    pot.playerNo = player.playerNo;
                                                    pot.tableId = player.table;
                                                    pot.type = 'main';
                                                    Pot.AddToMainPort(pot, player, function (err, data) {
                                                        if (err) {
                                                            callback(err);
                                                        } else {
                                                            Player.nextInPlay(player, callback);
                                                        }
                                                    });
                                                } else {
                                                    callback(null, player);
                                                }
                                            }
                                        ], callback);
                                    }
                                });

                            } else {
                                async.waterfall(
                                    [
                                        function (callback) {
                                            CommunityCards.closeServe(tableId, function (err) {
                                                callback(err);
                                            });
                                        },
                                        function (callback) {
                                            Player.update({
                                                table: tableId
                                            }, {
                                                $set: {
                                                    hasRaised: false,
                                                    isLastBlind: false,
                                                    isTurn: false
                                                }
                                            }, {
                                                multi: true
                                            }, function (err) {
                                                callback(err);
                                            });
                                        },
                                        function (callback) {
                                            Player.findDealerNext({
                                                table: tableId
                                            }, callback);
                                        }
                                    ], callback);
                            }
                        },
                        function (player, callback) { // Enable turn from the same
                            // player.turn = true;
                            console.log("player...........", player);
                            CommunityCards.setTimeOut(player.table, player.playerNo);
                            player.isTurn = true;
                            player.save(callback);
                        }
                    ], callback);
                } else {
                    if (cardNo == 7) {
                        Player.showWinner({
                            tableId: tableId
                        }, callback);
                    } else {
                        callback();
                    }
                }
            }
        });


    },
    raise: function (data, callback) {
        var tableId = data.tableId;
        console.log("tableId", tableId);
        Player.getPlayer(data, function (err, data1) {
            if (err) {
                callback(err);
            } else {
                async.waterfall([
                    function (callback) { // Remove All raise
                        Player.update({
                            table: tableId
                        }, {
                            $set: {
                                hasRaised: false,
                                isLastBlind: false,
                                hasCalled: false,
                                hasChecked: false,
                                hasRaisedd: false
                            }
                        }, {
                            multi: true
                        }, function (err, cards) {
                            callback(err, tableId);
                        });
                    },
                    Player.currentTurn,
                    function (player, callback) {
                        player.hasRaised = true;
                        player.hasRaisedd = true;
                        player.save(function (err, data) {

                            callback(err, data);
                        });
                    },
                    function (player, callback) {
                        Pot.solvePot(player, 'raise', data.amount, function (err, data) {
                            Table.blastSocket(tableId, data);
                            callback(err, tableId);
                        });
                    },
                    Player.changeTurn
                ], callback);
            }
        });
    },
    call: function (data, callback) {
        console.log("inside call", data.tableId);
        var tableId = data.tableId;
        Player.getPlayer(data, function (err, data) {
            if (err) {
                callback(err);
            } else {

                async.waterfall([
                    function (callback) { // Remove All raise
                        Player.update({
                            table: tableId
                        }, {
                            $set: {
                                hasCalled: false,
                                hasChecked: false,
                                hasRaisedd: false,
                                hasRaised: false
                            }
                        }, {
                            multi: true
                        }, function (err, cards) {
                            callback(err, tableId);
                        });
                    },
                    Player.currentTurn,
                    function (player, callback) {
                        player.hasCalled = true;
                        player.save(function (err, data) {
                           
                            callback(err, data);
                        });
                    },
                    function (player, callback) {
                        console.log("player", player);
                        console.log("inside callback check", callback);
                        Pot.solvePot(player, 'call', 0, function (err, data) {
                                Table.blastSocket(tableId, data);   
                            callback(err);
                        });
                    },
                    function (callback) {
                        Player.changeTurn(tableId, callback);
                    }

                ], callback);
            }
        });

    },

    getAllInfo: function (tableId, callback) {
        async.parallel({
            players: function (callback) {
                Player.find({
                    table: tableId,
                    isActive: true
                }).deepPopulate("user").exec(callback);
            },

            table: function (callback) {
                Table.findOne({
                    _id: tableId
                }).exec(callback);
            },
            pots: function (callback) {
                Pot.find({
                    table: tableId
                }).sort({
                    _id: 1
                }).lean().exec(callback);
            }
        }, callback);
    },
    check: function (data, callback) {
        var tableId = data.tableId;
        Player.getPlayer(data, function (err, data) {
            if (err) {
                callback(err);
            } else {
                async.waterfall([
                    function (callback) { // Remove All raise
                        Player.update({
                            table: tableId
                        }, {
                            $set: {
                                hasCalled: false,
                                hasChecked: false,
                                hasRaisedd: false,
                                hasRaised: false,
                            }
                        }, {
                            multi: true
                        }, function (err, cards) {
                            callback(err, tableId);
                        });
                    },
                    Player.currentTurn,
                    function (player, callback) {
                        player.hasChecked = true;
                        player.save(function (err, data) {
                            // Table.blastSocket(tableId);
                            callback(err, tableId);
                        });
                    },
                    Player.changeTurn
                ], callback);
            }
        });
    },
    fold: function (data, callback) {
        var tableId = data.tableId;
        Player.getPlayer(data, function (err, data) {
            console.log("data in", data);
            if (err) {
                callback(err);
            } else {
                async.waterfall([
                    function (callback) { // Remove All raise
                        Player.update({
                            table: tableId
                        }, {
                            $set: {
                                hasCalled: false,
                                hasChecked: false,
                                hasRaisedd: false,
                                hasRaised: false
                            }
                        }, {
                            multi: true
                        }, function (err, cards) {
                            callback(err, tableId);
                        });
                    },
                    Player.currentTurn,
                    function (player, callback) {
                        console.log("after current turn");
                        player.isFold = true;
                        player.save(function (err, data) {
                            callback(err, data);
                        });
                    },
                    function (Player, callback) {
                        console.log("make transaction");
                        Transaction.tableLostAmount(Player, callback);
                    },
                    function (arg1, callback) {
                        console.log("last callback");
                        Player.find({
                            isFold: false,
                            isActive: true,
                            table: tableId,
                            // isAllIn: false
                        }).exec(function (err, data) {
                            if (err) {
                                callback(err);
                            } else {
                                if (data.length == 1) {
                                    Player.showWinner({
                                        tableId: tableId
                                    }, function (err, data) {
                                        if (err) {
                                            callback(err);
                                        } else {
                                            callback(null, tableId);
                                        }
                                    });
                                    // data[0].winner = true;
                                    // Player.blastSocketWinner({
                                    //     winners: data
                                    // });

                                } else {
                                    callback(null, tableId);
                                }
                            }

                        });
                    },

                    Player.changeTurn
                ], function (err, data) {
                    console.log("final function");
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        console.log("err", err);
                        console.log("data", data);
                        Table.blastSocket(tableId);
                        callback(err, data);
                    }
                });
            }
        });
    },
    whetherToEndTurn: function (fromPlayer, toPlayer, callback) {
        var tableId = fromPlayer.table;
        async.parallel({
            allPlayers: function (callback) {
                Player.find({
                    $or: [{
                        table: tableId,
                        isActive: true,
                        //isAllIn: false
                    }, {
                        table: tableId,
                        hasRaised: true
                    }, {
                        table: tableId,
                        isDealer: true
                    }]
                }).sort({
                    playerNo: 1
                }).exec(callback);
            },
            allDetails: function (callback) {
                Player.getAllDetails({
                    tableId: tableId
                }, callback);
            },
            communityCards: function (callback) {
                CommunityCards.find({
                    tableId: tableId,
                    isBurn: false,
                    cardValue: {
                        $nin: ["", " ", null]
                    }
                }).exec(callback);
            }
        }, function (err, data) {
            if (err) {
                callback(err);
            } else if (_.isEmpty(data.allPlayers)) {
                callback("No Players found in Whether to end turn");
            } else {
                //getTableID
                console.log("whether to end turn");
                var allPlayers = data.allPlayers;
                var fromPlayerPartition = _.partition(allPlayers, function (n) {
                    return n.playerNo >= fromPlayer.playerNo;
                });

                var fromPlayerFirst = _.concat(fromPlayerPartition[0], fromPlayerPartition[1]);

                var toIndex = _.findIndex(fromPlayerFirst, function (n) {
                    return n.playerNo == toPlayer.playerNo;
                });
                var fromPlayerToPlayer = _.slice(fromPlayerFirst, 0, toIndex + 1);

                var allTurnDoneIndex = _.findIndex(allPlayers, function (p) {
                    return !p.hasTurnCompleted && !p.isFold && !p.isAllIn
                });

                var playingPlayers = _.filter(allPlayers, function (p) {
                    return !p.isFold && p.isActive
                });

                var allInPlayers = _.filter(allPlayers, function (p) {
                    return p.isAllIn && !p.isFold && p.isActive
                });

                var allTurnDone = false;
                var removeAllTurn = false;
                var isWinner = false;
                var declareWinner = false;

                console.log("allTurnDoneIndex ", allTurnDoneIndex);
                if (allTurnDoneIndex < 0) {
                    allTurnDone = true;
                }

                console.log("all data", data.allDetails);
                var amountStatus = Pot.equalAmountStatus(data.allDetails);

                console.log("allTurnDone", allTurnDone);
                console.log("amountStatus", amountStatus);
                if (allTurnDone && amountStatus) {
                    removeAllTurn = true;
                }

                if (removeAllTurn && !_.isEmpty(data.communityCards) && data.communityCards.length == 5) {
                    declareWinner = true;
                }

                console.log("data.communityCards", data.communityCards);
                // if (playingPlayers.length < 1) {
                //     declareWinner = true;
                // }

                if (removeAllTurn && playingPlayers.length == 1) {
                    declareWinner = true;
                }

                if (declareWinner) {
                    removeAllTurn = true;
                }
                // case 1 
                // When fromPlayer.isLastBlind checks
                // if (fromPlayer.isLastBlind) {
                //     red(1);
                //     removeAllTurn = true;
                // }

                // case 2
                // When toPlayer.hasRaised
                // var isRaisedBetween = _.findIndex(fromPlayerToPlayer, function (n, index) {
                //     return (n.hasRaised && index !== 0);
                // });
                // // Find Players between 
                // if (isRaisedBetween > 0) {
                //     red(2);
                //     removeAllTurn = true;
                // }

                // case 3
                // When fromPlayer.isDealer && noOne has Raised
                // var lastRaise = _.findIndex(allPlayers, function (n) {
                //     return n.hasRaised;
                // });
                // var lastBlind = _.findIndex(allPlayers, function (n) {
                //     return n.isLastBlind;
                // });

                // var isDealerBetween = _.findIndex(fromPlayerToPlayer, function (n, index) {
                //     return (n.isDealer && (index != (fromPlayerToPlayer.length - 1)));
                // });
                // // Find Players between 
                // if (isRaisedBetween > 0) {
                //     red(3);
                //     removeAllTurn = true;
                // }
                // Main Error in Dealer Related Search WHEN Dealer Folds
                // if (lastRaise < 0 && lastBlind < 0 && isDealerBetween >= 0) {
                //     removeAllTurn = true;
                // }


                //case 4 from Player and To Player is Same
                if (fromPlayer.playerNo == toPlayer.playerNo) {
                    removeAllTurn = true;
                }


                if (removeAllTurn) {
                    //Show Winner to be checked
                    async.parallel({
                        removeServe: function (callback) {
                            CommunityCards.startServe(tableId, callback);
                        },
                        updateStatus: function (callback) {
                            Table.updateStatus(tableId, callback);
                        },
                        updatePlayers: function (callback) {
                            Player.update({
                                table: tableId
                            }, {
                                $set: {
                                    hasRaised: false,
                                    isLastBlind: false,
                                    isTurn: false,
                                    // hasCalled: false,
                                    //hasChecked: false,
                                    hasRaisedd: false,
                                    hasTurnCompleted: false
                                }
                            }, {
                                multi: true
                            }, function (err) {
                                callback(err);
                            });
                        },
                        declareWinner: function (callback) {
                            if (declareWinner) {
                                Player.showWinner({
                                    tableId: tableId
                                }, callback);
                            } else {
                                callback(null);
                            }
                        }
                    }, function (err, data) {
                        callback(err);
                    });

                } else {
                    callback(null);
                }
            }
        })
    },
    // whetherToEndTurn: function (fromPlayer, toPlayer, callback) {
    //     var tableId = fromPlayer.table;
    //     Player.find({
    //         $or: [{
    //             table: tableId,
    //             isActive: true,
    //             isAllIn: false
    //         }, {
    //             table: tableId,
    //             hasRaised: true
    //         }, {
    //             table: tableId,
    //             isDealer: true
    //         }]
    //     }).sort({
    //         playerNo: 1
    //     }).exec(function (err, allPlayers) {
    //         if (err) {
    //             callback(err);
    //         } else if (_.isEmpty(allPlayers)) {
    //             callback("No Players found in Whether to end turn");
    //         } else {
    //             //getTableID

    //             var fromPlayerPartition = _.partition(allPlayers, function (n) {
    //                 return n.playerNo >= fromPlayer.playerNo;
    //             });

    //             var fromPlayerFirst = _.concat(fromPlayerPartition[0], fromPlayerPartition[1]);

    //             var toIndex = _.findIndex(fromPlayerFirst, function (n) {
    //                 return n.playerNo == toPlayer.playerNo;
    //             });
    //             var fromPlayerToPlayer = _.slice(fromPlayerFirst, 0, toIndex + 1);

    //             var allTurnDoneIndex = _.findIndex(allPlayers, function (p) {
    //                 return !p.turn && !p.isFold
    //             });



    //             var allTurnDone = false;
    //             var removeAllTurn = false;
    //             var isWinner = false;


    //             if (allTurnDoneIndex == -1) {
    //                 allTurnDone = true;
    //             }

    //             // case 1 
    //             // When fromPlayer.isLastBlind checks
    //             if (fromPlayer.isLastBlind) {
    //                 red(1);
    //                 removeAllTurn = true;
    //             }

    //             // case 2
    //             // When toPlayer.hasRaised
    //             var isRaisedBetween = _.findIndex(fromPlayerToPlayer, function (n, index) {
    //                 return (n.hasRaised && index !== 0);
    //             });
    //             // Find Players between 
    //             if (isRaisedBetween > 0) {
    //                 red(2);
    //                 removeAllTurn = true;
    //             }

    //             // case 3
    //             // When fromPlayer.isDealer && noOne has Raised
    //             var lastRaise = _.findIndex(allPlayers, function (n) {
    //                 return n.hasRaised;
    //             });
    //             var lastBlind = _.findIndex(allPlayers, function (n) {
    //                 return n.isLastBlind;
    //             });

    //             var isDealerBetween = _.findIndex(fromPlayerToPlayer, function (n, index) {
    //                 return (n.isDealer && (index != (fromPlayerToPlayer.length - 1)));
    //             });
    //             // Find Players between 
    //             if (isRaisedBetween > 0) {
    //                 red(3);
    //                 removeAllTurn = true;
    //             }
    //             // Main Error in Dealer Related Search WHEN Dealer Folds
    //             if (lastRaise < 0 && lastBlind < 0 && isDealerBetween >= 0) {
    //                 removeAllTurn = true;
    //             }


    //             //case 4 from Player and To Player is Same
    //             if (fromPlayer.playerNo == toPlayer.playerNo) {
    //                 removeAllTurn = true;
    //             }


    //             if (removeAllTurn) {
    //                 //Show Winner to be checked
    //                 async.parallel({
    //                     removeServe: function (callback) {
    //                         CommunityCards.startServe(tableId, callback);
    //                     },
    //                     updateStatus: function (callback) {
    //                         Table.updateStatus(tableId, callback);
    //                     },
    //                     updatePlayers: function (callback) {
    //                         Player.update({}, {
    //                             $set: {
    //                                 hasRaised: false,
    //                                 isLastBlind: false,
    //                                 isTurn: false,
    //                                 hasCalled: false,
    //                                 hasChecked: false,
    //                                 hasRaisedd: false
    //                             }
    //                         }, {
    //                             multi: true
    //                         }, function (err) {
    //                             callback(err);
    //                         });
    //                     }
    //                 }, function (err, data) {
    //                     callback(err);
    //                 });

    //             } else {
    //                 callback(null);
    //             }
    //         }
    //     });


    // },
    findLastBlindNext: function (tableId, callback) {
        async.waterfall([
            function (callback) {
                Player.findOne({
                    table: tableId,
                    isLastBlind: true
                }).exec(callback);
            },
            Player.nextInPlay
        ], callback);

    },
    makeSmallBlind: function (smallBlind, callback) {
        Table.findOne({
            _id: smallBlind.table
        }).exec(function (err, data) {
            smallBlind.isSmallBlind = true;
            // smallBlind.amountAdded['preFlop'] = data.smallBlind;
            async.parallel({
                smallBlind: function (callback) {
                    smallBlind.save(function (err, data) {
                        callback(err, data)
                    });
                },
                makeEntry: function (callback) {
                    var pot = {};
                    pot.round = 'preFlop',
                        pot.amount = data.smallBlind;
                    pot.playerNo = smallBlind.playerNo;
                    pot.tableId = smallBlind.table;
                    pot.type = 'main';

                    Pot.AddToMainPort(pot, smallBlind, callback);
                }
            }, function (err, data) {
                callback(err, data.smallBlind);
            });

        });
    },
    makeBigBlind: function (bigBlind, callback) {
        Table.findOne({
            _id: bigBlind.table
        }).exec(function (err, data) {
            bigBlind.isBigBlind = true;
            //bigBlind.amountAdded['preFlop'] = data.bigBlind;

            async.parallel({
                smallBlind: function (callback) {
                    bigBlind.save(function (err, data) {
                        callback(err, data)
                    });
                },
                makeEntry: function (callback) {
                    var pot = {};
                    pot.round = 'preFlop';
                    pot.amount = data.bigBlind;
                    pot.playerNo = bigBlind.playerNo;
                    pot.tableId = bigBlind.table;
                    console.log(">>>>>>>>>>>>>>>>>>>makeEntry", pot);
                    pot.type = 'main';

                    Pot.AddToMainPort(pot, bigBlind, callback);
                }
            }, function (err, data) {
                callback(err, data.smallBlind);
            });
        });
    },
    findDealerNext: function (data, callback) {
        async.waterfall([
            function (callback) {
                Player.findOne({
                    table: data.table,
                    isDealer: true
                }).exec(callback);
            },
            Player.nextInPlay
        ], callback);
    },

    nextInPlay: function (player, callback) {
        if (player) {
            Player.find({
                table: player.table,
                isActive: true,
                isFold: false,
                isAllIn: false
            }).sort({
                playerNo: 1
            }).exec(function (err, players) {
                if (err) {
                    callback(err);
                } else if (_.isEmpty(players)) {
                    callback("No Next In Play");
                } else {
                    var finalPlayer = _.find(players, function (n) {
                        return (n.playerNo > player.playerNo);
                    });
                    if (finalPlayer) {
                        callback(err, finalPlayer);
                    } else {
                        callback(err, players[0]);
                    }
                }
            });
        } else {
            callback("No Player selected for Next");
        }

    },

    requiredData: function () {
        var data = {};
        data.table = {
            minimumBuyin: 1,
            smallBlind: 1,
            bigBlind: 1,
            name: 1,
            maximumNoOfPlayers: 1,
            status: 1,
        };
        data.player = {
            playerNo: 1,
            socketId: 1,
            hasRaised: 1,
            buyInAmt: 1,
            hasTurnCompleted: 1,
            isSmallBlind: 1,
            isBigBlind: 1,
            totalAmount: 1,
            hasCalled: 1,
            hasChecked: 1,
            isAllIn: 1,
            cards: 1,
            isDealer: 1,
            isFold: 1,
            isActive: 1,
            isTurn: 1,
            isLastBlind: 1
        };

        data.communityCards = {
            cardNo: 1,
            isBurn: 1,
            cardValue: 1
        };

        data.pot = {
            totalAmount: 1,
            players: 1,
            type: 1,
            winner: 1
        };
        return data;
    }
};
module.exports = _.assign(module.exports, exports, model);