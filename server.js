var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
app.use(bodyParser.urlencoded({
    extended: true
}));
const bcrypt = require('bcrypt-as-promised');

var path = require('path');

var flash = require('express-flash');

app.use(flash());
var session = require('express-session');
app.set('trust proxy', 1);
app.use(session({
    secret: 'penguinsrock',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 60000
    }
}));
var validate = require('mongoose-validate')

mongoose.connect('mongodb://localhost/dojosecrets');

var UserSchema = new mongoose.Schema({
    first_name: {
        type: String,
        required: [true, 'First name is required field'],
        minlength: [2, 'first name must be at least 2 characters long']
    },
    last_name: {
        type: String,
        required: [true, 'last name is a required field'],
        maxlength: [20, 'last name can not be more than 20 characters']
    },

    email: {
        type: String,
        unique: true,
        required: [true, 'Please enter a valid email'],
        dropDups: [true, 'Email already exists in database'],
        validate: [validate.email, 'is not a valid e-mail address']
    },

    birthday: {
        type: Date,
        required: [true, 'birthday is a required field']
    },
    password: {
        type: String,
        required: [true, 'password is a required field'],
        minlength: [6 , 'Password must be at least 6 characters long']
    }

}, {
    timestamps: true
});

const CommentSchema = new mongoose.Schema({
    author_id: {type:String, required: [true, "User must have a name"]},
    content: {type: String, required: [true, "Comment must have content"]}
}, {timestamps: true})
const SecretSchema = new mongoose.Schema({
    author_id: {type:String, required: [true, "User must have a name"]},
    content: {type: String, required: [true, "Message must have content"]},
    comments: [CommentSchema]
}, {timestamps: true})

mongoose.model('Secret', SecretSchema);
var Secret = mongoose.model('Secret')
mongoose.model('Comment', CommentSchema);
var Comment = mongoose.model('Comment')

mongoose.model('User', UserSchema);
var User = mongoose.model('User')

app.use(express.static(path.join(__dirname, './static')));

app.set('views', path.join(__dirname, './views'));

app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('index');
})

app.get('/secrets', function (req, res) {
    if (req.session.user_id == null){
        res.redirect('/')
    } else {
        res.locals.user_id = req.session.user_id
        Secret.find({}, function(err, secrets) {
            if (err) {
                console.log('error finding secrets')
            } else {
                Comment.find({}, function(err, comments) {
                    if (err) {
                        console.log('error finding comments')
                    } else {
                        res.render('secrets', {secrets: secrets,
                                            comments: comments});
                    }
                })
            }
        })
    }
})

app.get('/secrets/:id', function (req, res) {
    if (req.session.user_id == null){
        res.redirect('/')
    } else {
        res.locals.user_id = req.session.user_id
        Secret.findOne({_id: req.params.id}, function(err, secret){
            if(err) {
                console.log('hello');
                return res.redirect('/secrets')
            } else {
                res.render('specific', {secret: secret});
            }
        })
    }
})

app.post('/secrets/:id/delete', function(req, res) {
    Secret.remove({_id: req.params.id}, function(err) {
        if (err) { 
            console.log(err);
            res.redirect('/secrets')
         }
        
        res.redirect('/secrets');
      })
      console.log('finding secrets');
});

app.get('/logout', function(req, res) {
    req.session.user_id = null
    res.redirect('/')
})

app.post('/secrets', function(req, res){
    console.log("POST DATA", req.body);
    console.log(req.session.user_id)
    var secret = new Secret({content: req.body.content, author_id: req.session.user_id})
    secret.save(function(err){
        if(err) {
            console.log('saving secret');
            for(var key in err.errors){
                req.flash('form_validation', err.errors[key].message);
            }
            return res.redirect('/secrets')
        } else {
            console.log('successfully added a secret');
            res.redirect('/secrets')
        }
    })
})

app.post('/secrets/:id', function(req, res){
    console.log("POST DATA", req.body);
    var comment = new Comment({content: req.body.content, author_id: req.session.user_id})
    comment.save(function(err) {
        if(err) {
            console.log('posting comment went wrong');
            for(var key in err.errors){
                req.flash('form_validation', err.errors[key].message);
            }
            return res.redirect('/secrets')
        } else { 
            Secret.findOne({_id: req.params.id}, function(err, data){
                if(err){
                    console.log('hello')
                    return res.redirect('/secrets')
                } else {
                    data.comments.push({author_id: req.session.user_id, content: req.body.content})
                    data.save(function(err){
                        if(err){
                            console.log('what am i doing')
                            return res.redirect('/secrets')
                        } else{
                            res.redirect(`/secrets/${req.params.id}`)
                        }
                    })
                }
            })
        }
    })
})


app.post('/registration', function (req, res) {
    console.log("POST DATA", req.body);
    var user = new User({
        first_name: req.body.f_name,
        last_name: req.body.l_name,
        birthday: req.body.bday,
        email: req.body.email
    });
    console.log("prossesed info")
    bcrypt.hash(req.body.password, 10)
        .then(hashed => {
            user.password = hashed;
            console.log("hashing")
            user.save(function (err, user) {
                    if (err) {
                        for (var key in err.errors) {
                            req.flash("form_validation", err.errors[key].message);
                        }
                        return res.redirect("/");
                    } else {
                        req.session.user_id = user._id;
                        console.log(user._id)
                        req.session.email = user.email;
                        res.redirect("/secrets");
                    }
                })
            })
        .catch(error => {
        console.log("oops! something went wrong", error);
        req.flash("form_validation", 'Password needs to be at least 5 characters long');
        res.redirect("/");
    });
});



app.post('/login', function (req, res) {
    User.findOne({ email: req.body.email}, function(err, user){
        if (err) {
            res.redirect("/");
            for (var key in err.errors) {
                req.flash("form_validation", err.errors[key].message);
            }
            return res.redirect("/");
        }
        else {
            bcrypt.compare(req.body.password, user.password)
                .then(result => {
                    req.session.user_id = user._id;
                    console.log(user._id)
                    req.session.email = user.email;
                    res.redirect("/secrets");
                })
                .catch(error => {
                    console.log("oops! something went wrong", error);
                    
                    req.flash("form_validation", 'Either Username or Password is Incorrect');
                    res.redirect("/");
                });
        }
    });
});

app.listen(8000, function () {
    console.log("listening on port 8000");
})