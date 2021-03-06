var schema = new Schema({
    name: {
        type: String,
        required: true,

    },
    email: {
        type: String,
        validate: validators.isEmail(),
        unique: true
    },
    dob: {
        type: Date,

    },
    balance: {
        type: Number,
        default: 0
    },
    tableAmt: {
        type: Number,
        default: 0
    },

    oneSingleId: [String],
    // photo: {
    //     type: String,
    //     default: "",
    //     excel: [{
    //         name: "Photo Val"
    //     }, {
    //         name: "Photo String",
    //         modify: function (val, data) {
    //             return "http://abc/" + val;
    //         }
    //     }, {
    //         name: "Photo Kebab",
    //         modify: function (val, data) {
    //             return data.name + " " + moment(data.dob).format("MMM DD YYYY");
    //         }
    //     }]
    // },
    password: {
        type: String,
        default: ""
    },
    forgotPassword: {
        type: String,
        default: ""
    },
    mobile: {
        type: String,
        unique: true,
        default: ""
    },
    city: {
        type: String,
        default: ""
    },
    country: {
        type: String,
        default: ""
    },
    otp: {
        type: String,
        default: ""
    },

    accessToken: {
        type: [String],
        index: true
    },
    type:{
        type: String,
        enum: ['Normal','Other']
    },
    // googleAccessToken: String,
    // googleRefreshToken: String,
    // oauthLogin: {
    //     type: [{
    //         socialId: String,
    //         socialProvider: String
    //     }],
    //     index: true
    // },
    accessLevel: {
        type: String,
        default: "User",
        enum: ['User', 'Admin']
    },
    socketId: String,
    table: Schema.Types.ObjectId
});

schema.plugin(deepPopulate, {
    populate: {
        'user': {
            select: 'name _id'
        }
    }
});
schema.plugin(uniqueValidator);
schema.plugin(timestamps);

module.exports = mongoose.model('User', schema);

var exports = _.cloneDeep(require("sails-wohlig-service")(schema, "user", "user"));
var model = {
    signUp: function (userData, callback) {
        console.log(userData);
        //userData.dob = new Date(userData.dob);
        userData.password = md5(userData.password);
        // userData.accessToken = [uid(16)];
        var user = new this(userData);
        user.save(function (err, data) {
            console.log(data);
            if (err) {
                console.log(err);
                callback(err);
            } else {

                callback(err, "Registered Successfully");
            }
        });
    },
    createUser: function (user, callback) {
        user.password = md5(user.password);
        if (user._id) {
            user.isNew = false;
        } 
        user = new this(user);
       
        user.save(callback);
    },
    login: function (user, callback) {
        var Model = this;
        console.log(user);
        Model.findOne({
            mobile: user.mobile,
            password: md5(user.password)
        }).exec(
            function (err, data) {
                if (err) {
                    callback(err);
                } else {
                    if (!_.isEmpty(data)) {
                        var otp = 2222;
                        //var otp = _.random(1000, 9999);
                        console.log(otp);
                        data.otp = otp;

                        data.save(function (err, data) {
                            if (err) {
                                callback(err);
                            } else {
                                callback(err, {
                                    _id: data._id
                                });
                            }
                        });
                    } else {
                        callback("Invalid Credentials");
                    }
                }
            }
        );
    },
    connectSocket: function (data, callback) {
        Dealer.update({
            accessToken: data.accessToken
        }, {
            socketId: data.socketId
        }).exec(callback);
    },
    adminLogin: function (admin, callback) {
        console.log(admin);
        var Model = this;
        Model.findOne({
            mobile: admin.mobile,
            password: md5(admin.password)
        }).exec(function (err, data) {
            console.log("data", data);
            if (err) {
                callback(err);
            } else {
                if (!_.isEmpty(data)) {
                    console.log(data);
                    var accessToken = [uid(16)];
                    data.accessToken = accessToken;
                    data.table = admin.tableId;
                    data.socketId = admin.socketId
                    data.save(function (err, data) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(err, {
                                accessToken: accessToken
                            });
                        }
                    });
                } else {
                    callback("Invalid credentials");
                }
            }
        });
    },
    varifyMobile: function (data, callback) {
        var Model = this;
        Model.findOne({
            mobile: data.mobile
        }).exec(function (err, data) {
            if (err) {
                callback(err);
            } else {
                if (!_.isEmpty(data)) {
                    var otp = 2222;
                    //var otp = _.random(1000, 9999);
                    console.log(otp);
                    data.otp = otp;

                    data.save(function (err, data) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(err, {
                                _id: data._id
                            });
                        }
                    });

                } else {
                    callback("Not found");
                }
            }
        });
    },
    setPassword: function (data, callback) {
        var Model = this;
        console.log(data);
        Model.findOneAndUpdate({
            _id: data._id
        }, {
            password: md5(data.password),
        }).exec(function (err, data) {
            if (err) {
                callback(err);
            } else {
                callback(err, "Password updated successfully")
            }
        });

    },
    verifyOtp: function (data, callback) {
        console.log(data);
        var Model = this;
        Model.findOne({
            _id: data._id,
            otp: data.otp
        }).exec(function (err, data) {
            if (err) {
                callback(err);
            } else {
                if (!_.isEmpty(data)) {
                    console.log(data);
                    var accessToken = [uid(16)];
                    data.accessToken = accessToken;
                    data.save(function (err, data) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(err, {
                                accessToken: accessToken
                            });
                        }
                    });
                } else {
                    callback("Otp verfication failed");
                }
            }
        });
    },
    existsSocial: function (user, callback) {
        var Model = this;
        Model.findOne({
            "oauthLogin.socialId": user.id,
            "oauthLogin.socialProvider": user.provider,
        }).exec(function (err, data) {
            if (err) {
                callback(err, data);
            } else if (_.isEmpty(data)) {
                var modelUser = {
                    name: user.displayName,
                    accessToken: [uid(16)],
                    oauthLogin: [{
                        socialId: user.id,
                        socialProvider: user.provider,
                    }]
                };
                if (user.emails && user.emails.length > 0) {
                    modelUser.email = user.emails[0].value;
                    var envEmailIndex = _.indexOf(env.emails, modelUser.email);
                    if (envEmailIndex >= 0) {
                        modelUser.accessLevel = "Admin";
                    }
                }
                modelUser.googleAccessToken = user.googleAccessToken;
                modelUser.googleRefreshToken = user.googleRefreshToken;
                if (user.image && user.image.url) {
                    modelUser.photo = user.image.url;
                }
                Model.saveData(modelUser, function (err, data2) {
                    if (err) {
                        callback(err, data2);
                    } else {
                        data3 = data2.toObject();
                        delete data3.oauthLogin;
                        delete data3.password;
                        delete data3.forgotPassword;
                        delete data3.otp;
                        callback(err, data3);
                    }
                });
            } else {
                delete data.oauthLogin;
                delete data.password;
                delete data.forgotPassword;
                delete data.otp;
                data.googleAccessToken = user.googleAccessToken;
                data.save(function () {});
                callback(err, data);
            }
        });
    },
    profile: function (data, callback, getGoogle) {
        console.log("profile ", data);
        var str = "name email mobile balance city country";
        if (getGoogle) {
            str += " googleAccessToken googleRefreshToken";
        }
        User.findOne({
            accessToken: data.accessToken
        }, str).exec(function (err, data) {
            if (err) {
                callback(err);
            } else if (data) {
                callback(null, data);
            } else {
                callback("Please Login First.", data);
            }
        });
    },
    updateAccessToken: function (id, accessToken) {
        User.findOne({
            "_id": id
        }).exec(function (err, data) {
            data.googleAccessToken = accessToken;
            data.save(function () {});
        });
    },
    /**
     * This function get all the media from the id.
     * @param {userId} data
     * @param {callback} callback
     * @returns  that number, plus one.
     */
    getAllMedia: function (data, callback) {

    }
};
module.exports = _.assign(module.exports, exports, model);