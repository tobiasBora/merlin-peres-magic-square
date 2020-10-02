// Use <display
Vue.component('display-player', {
    props: ['player'],
    template: '<span><span v-if="player.extra && player.extra.fullName" v-bind:title="player.userid">{{ player.extra.fullName }}</span> <span v-else>{{ player.userid }}</span></span>'
})

var app = new Vue({
    el: '#app',
    data: {
        connection: new RTCMultiConnection(),
        myFullName: Math.random().toString(36).substring(7),
        // Usual steps:
        // connectToRoom
        // -> searchPlayers
        // -> 
        currentStep: "connectToRoom",
        roomName: "roomQuantumMagicSquare",
        // List of 
        potentialPlayers: [ ],
        message: "No important message so far",
    },
    watch: {
        myFullName: function(oldName, newName) {
            this.updateUsername();
        }
    },
    mounted: function() {
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
                console.log("Hello friend");
                this.connection.send('hello everyone');
                this.updateUsername();
            };
            this.connection.onmessage = (event) => {
                console.log(event.userid + ' said: ' + event.data);
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
        }
    },
})
