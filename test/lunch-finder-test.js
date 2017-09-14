let Helper = require('hubot-test-helper');
let chai = require('chai');

let expect = chai.expect;

helper = new Helper('../src/lunch-finder.js')

describe ('lunch-finder', function() {
  let room = null;

  beforeEach(function() {
    room = helper.createRoom()
  })

  afterEach(function() {
    room = room.destroy()
  })

  it('hears \'.*where.*lunch.*\'', function(done) {
    this.timeout(7000);
    room.user.say('bob', 'Where should we go to lunch?')
    .then(()=>{
      sleep(5000).then(() => {
        console.log('MESSAGES LATER: ', room.messages);
        expect(room.messages).to.eql([
          ['bob', 'Where should we go to lunch?']
          ['hubot', 'yarly']
        ]);
        done();
      })
      .catch((error) => {
        console.log(error);
        expect(error).to.not.exist();
        done();
      })
    })
  })

});

function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
