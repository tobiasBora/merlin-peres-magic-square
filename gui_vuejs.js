// ###############################################################################
// ########## This is my first project with Vue.js, forgive me any poor design ;-)
// ###############################################################################
// TODO: split the main component into two components: one for connecting, and one for playing, and use
// the bus to make them interract (see what I did with the quantum computer)
// TODO: see if we need to destruct the listeners or not

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
            /* See maybe proper solutions here, like dependency injections... 
               https://vuejs.org/v2/guide/components-edge-cases.html
             */
            this.$set(this.$parent.values_game, i, - this.$parent.values_game[i]);
        },
    },
    computed: {
        // Answer if a button should be displayed in row i column j
        shouldDisplay: function () {
            if (this.$parent.role == "Alice") {
                if (this.i == this.$parent.my_challenge) {
                    return true
                } else {
                    return false
                }
            } else {
                if (this.j == this.$parent.my_challenge) {
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

// Creates a basic quantum computer
// for the magic square game. It *should* be thread safe since javascript does not
// interupt a block of code (except it it contains inside it some async calls, which is not the case
// in this module)
class QuantumComputerMagicSquare {
    constructor(){
        // Creates 5 qubits: 2 bell pairs [0-1] and [2-3], and one auxiliary qubit for the measurements.
        var bell_pair = jsqubits('|00>').hadamard(0).controlledX(0,1);
        // Qubit 0 is the right most qubit!
        this.quantum_state = jsqubits('|0>').tensorProduct(bell_pair).tensorProduct(bell_pair);
        this.index_bell_1_alice = 0;
        this.index_bell_1_bob = 1;
        this.index_bell_2_alice = 2;
        this.index_bell_2_bob = 3;
        this.index_auxiliary_qubit = 4;
        console.log("After the constructor runs, the state exists:", this.quantum_state);
    }
    
    // observable is a string like "+XI". The first char is + or -, the two next chars are X, Y or Z.
    // indexQubits is an arrow of size 2, corresponding to the two qubits on which we perform the measurement
    measureObservable(indexQubits, observable){
        console.log("beginning mesureobservable, the state exists:", this.quantum_state);
        // For the two chars:
        for(var i=0; i<2; i++) {
            var obs = observable[i+1];
            var qubit = indexQubits[i];
            if (obs == 'I') { // Nothing to do
            } else if (obs == 'X') { // X = HZH, so like Z observable with 
                this.quantum_state = this.quantum_state
                                         .hadamard(qubit)
                                         .controlledX(qubit, this.index_auxiliary_qubit)
                                         .hadamard(qubit);
            } else if (obs == 'Z') {
                this.quantum_state = this.quantum_state
                                         .controlledX(qubit, this.index_auxiliary_qubit);
            } else if (obs == 'Y') {
                // Y = (HS^\dagger)^\dagger Z HS^\dagger = SH Z HS^\daager
                // with S = matrix(1 0 \\ 0 i) is the phase gate, and S^\dager = r(qubit, -Math.PI/2)
                this.quantum_state = this.quantum_state
                                         .r(qubit, -Math.PI/2)
                                         .hadamard(qubit)
                                         .controlledX(qubit, this.index_auxiliary_qubit)
                                         .hadamard(qubit)
                                         .s(qubit);
            }
        }
        if(observable[0] == '-') {
            this.quantum_state = this.quantum_state.x(this.index_auxiliary_qubit)
        }
        var res = this.quantum_state.measure(this.index_auxiliary_qubit);
        var measurement = res.result;
        this.quantum_state = res.newState;
        console.log("Here, the state exists:", this.quantum_state);
        // Put back auxiliary qubit to 0:
        if (measurement == 1) {
            console.log("And here, the state is:", this.quantum_state);
            this.quantum_state = this.quantum_state.x(this.index_auxiliary_qubit);
        }
        return (measurement == 0) ? "+1" : "-1"
    }
    
    aliceMeasureObservable(observable) {
        console.log("in alice measure, the state is:", this.quantum_state);
        return this.measureObservable([this.index_bell_1_alice, this.index_bell_2_alice], observable)
    }
    
    bobMeasureObservable(observable) {
        return this.measureObservable([this.index_bell_1_bob, this.index_bell_2_bob], observable)
    }
}

// ########## Quantum device ##########
Vue.component('quantum-magic-square', {
    props: ['bus', 'role',
            // Useful only for automatically providing the results
            'my_challenge', 'values_game'],
    template: '#quantum-magic-square',
    data: function () {
        return {
            possible_observables: [
                "I", "X", "Y", "Z"
            ],
            // The observable that the user is selecting right now
            sign_observable: "+",
            observable_first_qubit: "I",
            observable_second_qubit: "I",
            // The observable that the user wanted to measure
            last_sign_observable: "+",
            last_observable_first_qubit: "I",
            last_observable_second_qubit: "I",
            last_outcome: null,
            // A fix table to get the recommended measurements
            recommended_measurements: [
                ["+IZ", "+ZI", "+ZZ"],
                ["+XI", "+IX", "+XX"],
                ["-XZ", "-ZX", "+YY"],
            ],
            quantum_computer: null,
            // Useful to copy the measurement outcome on the square
            automatic_mode: false,
            // Useful to copy the measurement on the square only a few times
            // (because we clicked on "automatically play quantum strategy)
            semi_automatic_mode: 0,
        }
    },
    
    created: function() {
        if(this.role == 'Alice') {
            this.quantum_computer = new QuantumComputerMagicSquare();
            this.bus.$on("message-received-from-player", (evt_conn) => {
                console.log("Bob wants to measure an observable!");
                var data = evt_conn.event.data;
                if (data.type == "QUANTUM_MEASURE_OBS") {
                    var outcome = this.quantum_computer.bobMeasureObservable(data.obs);
                    this.bus.$emit("send-message-to-player", {
                        "type": "QUANTUM_MEASURE_OBS_RESULT",
                        "obs": data.obs,
                        "outcome": outcome,
                    });
                }
            });
        } else { // I'm Bob
            this.bus.$on("message-received-from-player", (evt_conn) => {
                console.log("I'm Bob and I received a message from my player :D", evt_conn);
                var data = evt_conn.event.data;
                if (data.type == "QUANTUM_MEASURE_OBS_RESULT") {
                    console.log("and guess what, it's a measurement result!", data);
                    this.last_outcome = data.outcome;
                    this.last_sign_observable = data.obs[0];                  
                    this.last_observable_first_qubit  = data.obs[1];                  
                    this.last_observable_second_qubit = data.obs[2];
                    this.automatically_copy_in_square();
                }
            });
        }
    },
    
    methods: {
        measure_observable: function() {
            console.log("Let's measure the observable!");
            this.last_outcome = null;
            var obs = this.sign_observable + this.observable_first_qubit + this.observable_second_qubit;
            if(this.role == 'Alice') {
                var result = this.quantum_computer.aliceMeasureObservable(obs);
                console.log("I measured:" + result);
                this.last_outcome = result;
                this.last_sign_observable = this.sign_observable;
                this.last_observable_first_qubit = this.observable_first_qubit;
                this.last_observable_second_qubit = this.observable_second_qubit;
                this.automatically_copy_in_square();
            } else {
                this.bus.$emit("send-message-to-player", {
                    "type": "QUANTUM_MEASURE_OBS",
                    "obs": obs,
                });
            }
        },
        select_observable_in_square: function(i,j) {
            console.log(this.recommended_measurements);
            console.log(i);
            console.log((this.recommended_measurements)[i]);
            var meas = (this.recommended_measurements)[i][j];
            this.sign_observable = meas[0];
            this.observable_first_qubit = meas[1];
            this.observable_second_qubit = meas[2];
        },
        apply_automatically_quantum_procedure: function () {
            this.semi_automatic_mode = 3;
            [0,1,2].forEach(i => {
                // Find the coordinate in the box
                var coord = (this.role == 'Alice') ? [this.my_challenge, i] : [i, this.my_challenge];
                this.select_observable_in_square(coord[0], coord[1]);
                this.measure_observable(); // This function will update for us the values if needed
            });
        },
        find_coord_from_obs: function (obs) {
            for(var i=0; i<3; i++) {
                for(var j=0; j<3; j++) {
                    if (this.recommended_measurements[i][j] == obs) {
                        console.log("I found coord " + [i,j] + " for obs " + obs);
                        return [i,j]
                    } else {
                        console.log(this.recommended_measurements[i][j] + " != " + obs);
                    }
                }
            }
            console.log("Strange, I can't find any coord for the obs " + obs);
            return null
        },
        automatically_copy_in_square: function () {
            if(this.automatic_mode || this.semi_automatic_mode > 0) {
                console.log("I'm in automatic mode!");
                var obs = this.last_sign_observable + this.last_observable_first_qubit + this.last_observable_second_qubit;
                console.log("Observable is " + obs + " and outcome is " + this.last_outcome);
                var coord = this.find_coord_from_obs(obs);
                if (coord !== null) {
                    if ((this.role == 'Alice' && coord[0] != this.my_challenge)
                        || (this.role != 'Alice' && coord[1] != this.my_challenge)) {
                        console.log("WARNING: I don't have coords that correspond to my_challenge!");
                        return;
                    }
                    this.$set(this.values_game,
                              (this.role == 'Alice') ? coord[1] : coord[0],
                              parseInt(this.last_outcome));
                    this.semi_automatic_mode--;
                    console.log("this.values_game: " + this.values_game);
                    this.$emit("update:values_game", this.values_game);
                }
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

// TODO: cut this huge component in at least 2 (one for connection, one for game)
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
        my_challenge: 0,
        values_game: [1,1,1],
        has_submitted: false,
        win_status: 0,
        wants_restart: false,
        // Use a local bus to emit an event when a new message is received
        // See https://stackoverflow.com/questions/43256978/event-from-parent-to-child-component/43258428#43258428
        // and https://stackoverflow.com/a/43257152/4987648
        // We can refer to this one as this.$root.bus (but it's not really a local bus, we are back to a global
        // bus), or we can v-bind it to components. Or, for fun, we can combine it with dependency injection
        // to always provide a bus to our elements ;-) (see
        // https://fr.vuejs.org/v2/guide/components-edge-cases.html#Injection-de-dependances).
        // Or maybe use vuex... later maybe.
        // See also the signals that I created, like thing that you can emit:
        // - send-message
        // - send-message-to-player
        // and things that you can listen to:
        // - message-received
        // - message-received-only-for-me
        // - message-received-from-player
        bus: new Vue(),
    },
    watch: {
        myFullName: function(oldName, newName) {
            this.updateUsername();
        }
    },
    // See also mounted, that will run later when mounted in the DOM
    created: function() {
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
                // Allow other components to receive and send messages (NB: you should avoid to use
                // the this.connection if possible, if you want to subscribe to events that are
                // meant only for you, use message-received-only-for-me :
                this.bus.$emit("message-received", {event: event, connection: this.connection});
                if(event.data.dst == this.connection.userid) {
                    console.log("The message is for me :)");
                    this.bus.$emit("message-received-only-for-me", {event: event, connection: this.connection});
                    // Check if the message is coming from a player
                    if(this.isPlayingWith
                       && this.isPlayingWith.userid
                       && event.userid
                       && this.isPlayingWith.userid == event.userid) {
                        this.bus.$emit("message-received-from-player", {event: event,
                                                                        connection: this.connection});
                    }
                    if(event.data.type == "ASK_PLAY" && ! this.isPlayingWith) {
                            console.log("Someone wants to play with me.");
                        this.listInvitations.push(this.connection.peers[event.userid]);
                    }
                    if(event.data.type == "OK_PLAY" && (!this.isPlayingWith
                                                     || this.wants_restart)) {
                        console.log("Someone agrees to play with me.");
                        this.isPlayingWith = this.connection.peers[event.userid];
                        this.resetGameBob();
                        this.my_challenge = event.data.challengeBob;
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
                        this.my_challenge = event.data.challengeBob;
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
            // Allow other modules to send messages by emitting send-message:
            // with this.bus.$emit("send-message", mymessage). See also send-message-to-player
            this.bus.$on('send-message', (...args) => this.connection.send(...args));
            this.bus.$on('send-message-to-player', (message) => {
                // message must be an object like { type: "ASK_PLAY", "message": "Yes" }.
                // Note that a "dst" field will be added automatically, so don't use it for your own purpose.
                console.log('I received the order to send a message to the player', message);
                if (this.isPlayingWith && this.isPlayingWith.userid) {
                    console.log("I'm playing with someone, great!");
                    message.dst = this.isPlayingWith.userid;
                    this.connection.send(message, this.isPlayingWith.userid);
                } else {
                    console.log("WARNING: I'm not playing with anyone, I won't send anything :(");
                }
            });
        },
        resetGameAlice: function () {
            this.role = "Alice";
            this.magicGame = new MagicGame();
            this.my_challenge = this.magicGame.getChallengeAlice();
            this.win_status = 0;
            this.has_submitted = false;
            this.wants_restart = false;
        },
        resetGameBob: function () {
            this.role = "Bob";
            this.win_status = 0;
            this.has_submitted = false;
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
            this.has_submitted = true;
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
        },
    },
})

