require('dotenv').config()

var Datastore = require('nedb')
var db = new Datastore({
  filename: 'apiUsage.db',
  autoload: true
});

function RateLimit(options) {

  options = Object.assign({windowMs: 60*1000, max: 10},options)

  const rateLimiter = (req, res, next) => {

    // Retrieve details from request
    var ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
    let ts = Date.now()
  
    var doc = {
      ip: ip,
      path: req.path,
      timestamp: ts
    }
  
    db.find({
      ip: ip,
      path: req.path,
      timestamp: {
        $gt: ts - options.windowMs
      }
    }, function (err, docs) {
      let remaining = options.max - docs.length
      res.set('X-RateLimit-Limit', options.max)
  
      if (remaining === 0) {
        // Rejected
        res.set('X-RateLimit-Remaining', remaining)
        let retry = docs[0].timestamp + options.windowMs
        res.set('Retry-After', new Date(retry))
        res.status(429).send(`You have exceeded the limit of ${options.max}, please try again later`)
      } else {
        // Accepted
        db.insert(doc, function (err, newDoc) {
          if (err) {
            console.error(err)
          }
        });
        res.set('X-RateLimit-Remaining', remaining-1)
        next()
      }
    })
  }

  return rateLimiter
}

module.exports = RateLimit