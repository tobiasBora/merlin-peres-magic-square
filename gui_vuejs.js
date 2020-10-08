// Templates, could also use https://vuejs.org/v2/guide/components-edge-cases.html#X-Templates
// Beware of https://vuejs.org/v2/guide/components.html#DOM-Template-Parsing-Caveats

// Use <display
Vue.component('display-player', {
    props: ['player'],
    template: '<span><span v-if="player.extra && player.extra.fullName" v-bind:title="player.userid">{{ player.extra.fullName }}</span> <span v-else>{{ player.userid }}</span></span>'
})

Vue.component('td-game', {
    props: ['i', 'j'],
    template: '<td><button v-if="shouldDisplay" v-on:click="toogle"> {{ indexToDisplay }} = {{ valueToDisplay }} </button><span v-else>?</span></td>',
    methods:{
        toogle: function() {
            var i = this.indexToDisplay;
            this.$set(this.$parent.values_game, i, - this.$parent.values_game[i]);
        },
    },
    computed: {
        // Answer if a button should be displayed in row i column j
        shouldDisplay: function () {
            if (this.$parent.role == "Alice") {
                if (this.i == this.$parent.myChallenge) {
                    return true
                } else {
                    return false
                }
            } else {
                if (this.j == this.$parent.myChallenge) {
                    return true
                } else {
                    return false
                }
            }
        },
        // Value to display at position (i,j)
        indexToDisplay: function () {
            if(!this.shouldDisplay) {
                return 0
            } else {
                if(this.$parent.role == 'Alice') {
                    return this.j
                } else {
                    return this.i
                }
            }
        },
        valueToDisplay: function () {
            if(!this.shouldDisplay) {
                return 0
            } else {
                return this.$parent.values_game[this.indexToDisplay];
            }
        }
    }
})

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

class MagicGame {
    constructor() {
        this.challengeAlice = randomIntFromInterval(0,2);
        this.challengeBob = randomIntFromInterval(0,2);
        this.answerAlice = null;
        this.answerBob = null;
    }
    // returns a row number [0,3[
    getChallengeAlice() {
        return this.challengeAlice
    }
    // returns a column number [0,3[
    getChallengeBob() {
        return this.challengeBob
    }
    isBool(x) {
        return (x == -1) || (x == 1)
    }
    // Gives 3 integers in {-1,+1}, origin board = top left
    setAnswerAlice(x1, x2, x3) {
        if (this.isBool(x1) && this.isBool(x2) && this.isBool(x3)) {
            this.answerAlice = [x1, x2, x3];
            return true
        } else {
            console.log("Alice did not gave +1/-1 answers");
            return false
        }
    }
    // Gives 3 integers in {-1,+1}, origin board = top left
    setAnswerBob(y1, y2, y3) {
        if (this.isBool(y1) && this.isBool(y2) && this.isBool(y3)) {
            this.answerBob = [y1, y2, y3];
            return true
        } else {
            console.log("Bob did not gave +1/-1 answers");
            return false
        }
    }

    // Returns 0 if don't know yet, 1 if win, -1 if lose
    isWin() {
        if (this.answerAlice && this.answerBob)
        {
            // Check the rules for Alice and Bob
            if (this.answerAlice.reduce((pv, cv) => pv * cv, 1) == -1) {
                console.log("Alice did not follow the rules");
                return -1
            }
            if (this.answerBob.reduce((pv, cv) => pv * cv, 1) == 1) {
                console.log("Bob did not follow the rules");
                return -1
            }
            // Check if they match
            if (this.answerAlice[this.challengeBob] == this.answerBob[this.challengeAlice]) {
                console.log("Win!");
                return 1;
            } else {
                console.log("Lose!" + this.answerAlice + "(" + this.challengeAlice + ") " + this.answerBob + "(" + this.challengeBob + ")");
                return -1;
            }
        } else {
            return 0;
        }
    }
}

var app = new Vue({
    el: '#app',
    data: {
        connection: new RTCMultiConnection(),
        myFullName: Math.random().toString(36).substring(7),
        // Usual steps:
        // connectToRoom
        // -> searchPlayers
        currentStep: "connectToRoom",
        roomName: "roomQuantumMagicSquare",
        // List of 
        potentialPlayers: [ ],
        message: "No important message so far",
        // Messages types
        // ASK_PLAY
        listInvitations: [ ],
        // isPlayingWith is null if the player is not playing
        // otherwise it corresponds to the user currently playing.
        isPlayingWith: null,
        role: "Alice",
        magicGame: null,
        myChallenge: 0,
        values_game: [1,1,1],
        win_status: 0,
        wants_restart: false,
    },
    watch: {
        myFullName: function(oldName, newName) {
            this.updateUsername();
        }
    },
    mounted: function() {
    },
    computed: {
        followRules: function () {
            if (this.role == "Alice") {
                return this.values_game.reduce((pv, cv) => pv * cv, 1) == 1
            } else {
                return this.values_game.reduce((pv, cv) => pv * cv, 1) == -1
            }
        }
    },
    methods: {
        connectToRoom: function () {
            // this.connection = new RTCMultiConnection();
            // this line is VERY_important
            this.connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
            // if you want text chat
            this.connection.session = {
                data: true
            };
            this.connection.onopen = (event) => {
                // console.log("Hello friend");
                // this.connection.send('hello everyone');
                this.updateUsername();
            };
            this.connection.onmessage = (event) => {
                // console.log(event.userid + ' said: ' + event.data);
                console.log("Received message: User " + event.userid + " type " + event.data.type);
                if(event.data.dst == this.connection.userid) {
                    console.log("The message is for me :)");
                    if(event.data.type == "ASK_PLAY" && ! this.isPlayingWith) {
                        console.log("Someone wants to play with me.");
                        this.listInvitations.push(this.connection.peers[event.userid]);
                    }
                    if(event.data.type == "OK_PLAY" && (!this.isPlayingWith
                                                        || this.wants_restart)) {
                        console.log("Someone agrees to play with me.");
                        this.isPlayingWith = this.connection.peers[event.userid];
                        this.resetGameBob();
                        this.myChallenge = event.data.challengeBob;
                    }
                    if(event.data.type == "GAME_ANSWER"
                       && this.isPlayingWith
                       && this.isPlayingWith.userid == event.userid
                       && this.role == "Alice") {
                        var a = event.data.answers_bob;
                        console.log("Bob gave me his answer:" + a);
                        this.magicGame.setAnswerBob(a[0],a[1],a[2]);
                        this.checkIfWin();
                    }
                    if(event.data.type == "WIN_STATUS"
                       && this.isPlayingWith
                       && this.isPlayingWith.userid == event.userid
                       && this.role == "Bob") {
                        console.log("Alice gave me the win status!");
                        this.win_status = event.data.win_status;
                    }
                    if(event.data.type == "ALICE_WANTS_RESTART"
                       && this.isPlayingWith
                       && this.isPlayingWith.userid == event.userid
                       && this.role == "Bob") {
                        this.resetGameBob();
                        this.myChallenge = event.data.challengeBob;
                    }
                    if(event.data.type == "BOB_WANTS_RESTART"
                       && this.isPlayingWith
                       && this.isPlayingWith.userid == event.userid
                       && this.role == "Alice") {
                        this.acceptToPlay(this.isPlayingWith);
                    }
                }
            };
            this.connection.openOrJoin(this.roomName, (isRoomCreated, roomid, error) => {
                if(error)
                    alert(error);
                if ( isRoomCreated ) {
                    this.currentStep = "searchPlayers"
                    console.log("looks ok");
                    console.log("Here we go:" + this.myFullName);
                    this.updateUsername();
                    this.updatePotentialPlayers();
                } else {
                    console.log("looks bad");
                }
            });
            this.connection.onExtraDataUpdated = (event) => {
                this.updatePotentialPlayers();
            };
            this.connection.onleave = (event) => {
                this.updatePotentialPlayers();
            };
            this.connection.onPeerStateChanged = (state) => {
                this.updatePotentialPlayers();
            };
            this.connection.onUserStatusChanged = (event) => {
                this.updatePotentialPlayers();
            };
            this.connection.onReConnecting = (event) => {
                this.updatePotentialPlayers();
            };
            // // If the initiator close the room, we can arrive in this funciton
            this.connection.onEntireSessionClosed = (event) => {
                alert('The initiator closed the room!', event.sessionid, event.extra);
            };
        },
        resetGameAlice: function () {
            this.role = "Alice";
            this.magicGame = new MagicGame();
            this.myChallenge = this.magicGame.getChallengeAlice();
            this.win_status = 0;
            this.wants_restart = false;
        },
        resetGameBob: function () {
            this.role = "Bob";
            this.win_status = 0;
            this.wants_restart = false;
        },
        updateUsername: function () {
            console.log("I'll update username");
            console.log("Step" + this.currentStep);
            console.log(this.myFullName);
            if (this.connection) {
                // Cannot use the first time:
                // this.connection.extra.fullName = this.myFullName;
                // due to:
                // https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
                this.$set(this.connection.extra, "fullName", this.myFullName);
                this.connection.updateExtraData();
                console.log("Updated extra!");
                console.log(this.connection.extra.fullName);
            }
            else {
                console.log("No connection :-(");
            }
        },
        updatePotentialPlayers: function () {
            console.log("Let's update the players!");
            this.potentialPlayers = this.connection.getAllParticipants().map( (participantId) => {
                return this.connection.peers[participantId];
            });
            console.log("Number of players: " + this.potentialPlayers.length);
        },
        connectToPlayer: function (player) {
            console.log("Will play with " + player.userid);
            this.connection.send(
                {
                    "type": "ASK_PLAY",
                    "dst": player.userid,
                },
                player.userid);
        },
        acceptToPlay: function (playerInvite, restart=false) {
            console.log("I accepted to play");
            this.listInvitations = this.listInvitations.filter(player => player.userid != playerInvite.userid);
            this.isPlayingWith = playerInvite;
            this.resetGameAlice();
            this.connection.send(
                {
                    "type": restart ? "ALICE_WANTS_RESTART" : "OK_PLAY",
                    "dst": this.isPlayingWith.userid,
                    "challengeBob": this.magicGame.getChallengeBob(),
                }, this.isPlayingWith.userid);
        },
        submitMyAnswer: function() {
            if(this.role == "Alice") {
                console.log("I'm alice and I'll submit the values" + this.values_game);
                this.magicGame.setAnswerAlice(this.values_game[0],this.values_game[1],this.values_game[2])
                this.checkIfWin();
            } else {
                this.connection.send(
                    {
                        "type": "GAME_ANSWER",
                        "dst": this.isPlayingWith.userid,
                        "answers_bob": this.values_game,
                    }, this.isPlayingWith.userid);
            }
        },
        checkIfWin: function() {
            this.win_status = this.magicGame.isWin();
            if(this.win_status != 0) {
                this.connection.send(
                    {
                        "type": "WIN_STATUS",
                        "dst": this.isPlayingWith.userid,
                        "win_status": this.win_status,
                    }, this.isPlayingWith.userid);
            }
        },
        stopPlaying: function() {
            this.isPlayingWith = null;
            this.win_status = 0;
        },
        restartGame: function() {
            console.log("I'd like to restart the game.");
            if(this.role == "Alice") {
                console.log("I'm alice and I want to restart.");
                this.acceptToPlay(this.isPlayingWith, true);
            } else {
                console.log("I'm Bob and I want to restart.");
                this.wants_restart = true;
                this.connection.send(
                    {
                        "type": "BOB_WANTS_RESTART",
                        "dst": this.isPlayingWith.userid,
                    }, this.isPlayingWith.userid);
            }
        }
    },
})
