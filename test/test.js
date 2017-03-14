/**
 * Created by Xingheng on 10/13/16.
 */

var assert = require('assert');
var util = require('util');

var mocks = require('node-mocks-http');
var Promise = require('promise/lib/es6-extensions');
var should = require('should');
var expect = require('chai').expect;
var _ = require('lodash');
var moesifExpress = require('../lib');

var TEST_API_SECRET_KEY = 'eyJhcHAiOiIyODU6NyIsInZlciI6IjIuMCIsIm9yZyI6IjM1MToxNSIsImlhdCI6MTQ4OTQ0OTYwMH0.3A83dY_foYtwlaqMcJV4gpThE-6wTCvoNryorQApdGo';

function mockReq(reqMock) {
  var reqSpec = _.extend({
    method: 'GET',
    url: '/hello',
    hostname: 'localhost:3000',
    protocol: 'http',
    headers: {
      'header1': 'value 1'
    },
    ip: '127.0.0.1',
    query: {
      val: '1'
    },
    params: {
      id: 20
    }
  }, reqMock);

  return mocks.createRequest(reqSpec);
}

function mockRes() {
  var res = mocks.createResponse();
  res.status(200);
  return res;
}

function loggerTestHelper(providedOptions, moesifOptions) {
  var options = _.extend({
    loggerOptions: null,
    req: null,
    res: null,
    next: function (req, res, next) {
      res.end('{ "msg": "ok."}');
    }
  }, providedOptions);

  var req = mockReq(options.req);
  // console.log('mocked req ' + JSON.stringify(req));
  var res = _.extend(mockRes(), options.res);


  return new Promise(function (resolve, reject) {
    var moesifMiddleWareOptions = _.extend({
      applicationId: TEST_API_SECRET_KEY,
      callback: function(err, logData) {
        if (err) {
          reject(err);
        } else {
          resolve(logData);
        }
      }
    }, moesifOptions);

    var middleware = moesifExpress(moesifMiddleWareOptions);

    middleware(req, res, function(_req, _res, next) {
      options.next(req, res, next);
      //resolve(result);
    });

  });
}

describe('moesif-express', function () {
  describe('fail cases', function () {
    it('throw an error when not provided an application id.', function () {
      expect(function () {
        moesifExpress({})
      }).to.throw(Error);
    });

    it('throw an error when identifyUser is not a function', function () {
      expect(function () {
        moesifExpress({
          applicationId: TEST_API_SECRET_KEY,
          identifyUser: 'abc'
        })
      }).to.throw(Error);
    });
  });



  describe('success cases', function () {

    this.timeout(3000);

    it('middleware should be function that takes 3 arguments', function() {
      expect(moesifExpress({applicationId: TEST_API_SECRET_KEY}).length).to.equal(3);
    });

    it('test one successful submission without body', function(done) {
      function next(req, res, next) {
        res.end();
      }

      var testHelperOptions = {
        next: next,
        req: {
          url: '/testnobody'
        }
      };
      loggerTestHelper(testHelperOptions).then(function (result) {
        // console.log('inside callback of loggerTesthelper');
        // console.log(JSON.stringify(result));
        expect(result.response).to.exist;
        expect(result.request).to.exist;
        done();
        // console.log('result in tester is:' + JSON.stringify(result, null, '  '));
      }).catch(function(err) {
        done(err);
      })
    });

    it('test moesif with body', function (done) {
      function next(req, res, next) {
        res.end('{"bodycontent1": "bodycontent1"}');
      }

      var testHelperOptions = {
        next: next,
        req: {
          body: {},
          url: '/testwithbody'
        }
      };

      loggerTestHelper(testHelperOptions).then(function (result) {
        expect(result.response.body.bodycontent1).to.equal('bodycontent1');
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('test moesif with identifyUser function', function (done) {
      function next(req, res, next) {
        res.end('{"test": "test moesif with identifyUser function"}');
      }

      var testHelperOptions = {
        next: next,
        req: {
          body: {},
          url: '/testwithidentifyuser'
        }
      };

      var testMoesifOptions = {
        applicationId: TEST_API_SECRET_KEY,
        identifyUser: function (_req, _res) {
          return 'abc';
        }
      };

      loggerTestHelper(testHelperOptions, testMoesifOptions).then(function (result) {
        expect(result.userId).to.equal('abc');
        done();
      }).catch(function(err) {
        done(err);
      });
    });


    it('test moesif with maskContent function', function (done) {
      function next(req, res, next) {
        res.end('{"test": "test moesif with maskContent function"}');
      }

      var testHelperOptions = {
        next: next,
        req: {
          headers: {
            'header1': 'value 1',
            'header2': 'value 2',
            'header3': 'value 3'
          },
          body: {'requestbody1': 'requestbody1'},
          url: '/testwithmaskcontent'
        }
      };

      var testMoesifOptions = {
        applicationId: TEST_API_SECRET_KEY,
        maskContent: function (_logData) {
          var maskedLogData = _.extend({}, _logData);
          maskedLogData.request.headers.header1 = undefined;
          return maskedLogData;
        }
      };

      loggerTestHelper(testHelperOptions, testMoesifOptions).then(function (result) {
        expect(result.request.headers.header1).to.not.exist;
        expect(result.request.headers.header2).to.equal('value 2');
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('test moesif with html body', function (done) {
      function next(req, res, next) {
        res.end('<html><body><h1>response body</h1><p>response body is html</p></body></html>');
      }

      var testHelperOptions = {
        next: next,
        req: {
          headers: {
            'header1': 'value 1',
            'header2': 'value 2',
            'header3': 'value 3'
          },
          body: '<html><body><h1>request body</h1><p>request body is html</p></body></html>',
          url: '/testwithhtmlbody'
        }
      };

      var testMoesifOptions = {
        applicationId: TEST_API_SECRET_KEY
      };

      loggerTestHelper(testHelperOptions, testMoesifOptions).then(function (result) {
        expect(result.request.transfer_encoding).to.equal('base64');
        expect(result.response.transfer_encoding).to.equal('base64');
        done();
      }).catch(function(err) {
        done(err);
      });
    });


    it('test moesif with malformed json', function (done) {
      function next(req, res, next) {
        res.end('{[abcd: ');
      }

      var testHelperOptions = {
        next: next,
        req: {
          headers: {
            'Content-Type': 'application/json',
            'header2': 'value 2',
            'header3': 'value 3'
          },
          body: '{"body1": "body1val"}',
          url: '/malformedbody'
        }
      };

      var testMoesifOptions = {
        applicationId: TEST_API_SECRET_KEY,
        maskContent: function (_logData) {
          var maskedLogData = _.extend({}, _logData);
          maskedLogData.request.headers.header1 = undefined;
          return maskedLogData;
        }
      };

      loggerTestHelper(testHelperOptions, testMoesifOptions).then(function (result) {
        expect(result.response.body.moesif_error).to.exist;
        done();
      }).catch(function(err) {
        done(err);
      });
    });


    it('should be able to update user profile to Moesif.', function(done) {
      var moesifMiddleware = moesifExpress({applicationId: TEST_API_SECRET_KEY});

      moesifMiddleware.updateUser({userId: 'testuserexpress3', metadata: {email: 'abc@email.com', name: 'abcdef', image: '123'}},
        function(error, response, context) {
          expect(context.response.statusCode).to.equal(201);
          if (error) done(error);
          else done();
        });
    });

  });

});
