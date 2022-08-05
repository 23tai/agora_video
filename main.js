let AIDenoiserModule = ""
let APP_ID = ""
let TOKEN = ""
let CHANNEL = ""
let USER_ID = ""
// const APP_ID = "YOUR APP ID"
// const TOKEN = "YOUR TEMP TOKEN"
// const CHANNEL = "YOUR CHANNEL NAME"

const client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})
let shareScreenClient = null

// we want to set some values to represent the local video
let localTracks = []
// and audio tracks along with the values to hold the remote users video or audio tracks
let remoteUsers = {}


let localScreenTracks = []

let UIDShareScreen = null

// for AIDenoiser
let processor = null
let denoiser = null


import('/node_modules/agora-extension-ai-denoiser/index.esm.js').then(function(module) {
// import('./node_modules/agora-extension-ai-denoiser/external/denoiser-wasm.js').then(function(module) {
    AIDenoiserModule = module
})


// local tracks will store the current user's video and audio track in a list
//  while all other users that join our stream will be called remote users and this will simply be an object


// to toggle our local user to join a stream with our camera and audio track 
let joinAndDisplayLocalStream = async () => {

    APP_ID =  document.getElementById('agora-app-id').value
    TOKEN =  document.getElementById('agora-token').value
    CHANNEL =  document.getElementById('agora-channel').value
    USER_ID =  document.getElementById('agora-user-id').value
    if (USER_ID == 0 || USER_ID == "null") {
        USER_ID = null
    }


    // subscribe to this event by calling client.on and setting the event to user-published and adding in our new function to test 
    client.on('user-published', handleUserJoined)
    
    client.on('user-left', handleUserLeft)
    
    // call the join method from the client object this method takes in all our app credentials and adds
    // our local user to the channel while returning back a uid
    let UID = await client.join(APP_ID, CHANNEL, TOKEN, USER_ID)
    // let UID = await client.join(APP_ID, CHANNEL, TOKEN, null)

    console.log("あいあいあいあいあいあああいあいあいあいああいあいあいあいあいあいあいいあいいいいい2")
    console.log(UID)
    console.log("あいあいあいあいあいあああいあいあいあいああいあいあいあいあいあいあいいあいいいいい2")
    // if a uid is not specified one will be automatically generated so setting this value to null is fine


    // set the local tracks value that we created earlier to the return value of the create microphone and
    //  camera tracks method this method will prompt a local user to access their camera and audio
    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks() 

    // and hold these values inside of the local tracks variable

    // once the video and audio tracks are created we need to create a place to display and store our stream
    // make sure that the parent container and child element both contain an id with the uid value from the user
    // because this is how we know which  dom elements to update once our element is created we will query the video
    // streams container and add in this new div into that container so it can be displayed
    let player = `<div class="video-container" id="user-container-${UID}">
                        <div class="video-player" id="user-${UID}"></div>
                  </div>`
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)


    /*
    the local tracks variable is now a list which holds the audio tracks in index 0 and the video track in 1
    call the play method which creates a video element and adds it inside of the html element which we specify by the id value

    */
    localTracks[1].play(`user-${UID}`)
    // audioが0  videoが1

    // finally we call the client.publish method to take our local video and audio tracks and we publish them so every user that in this channel can hear and see us 
    // here we publish the audio track from index 0 and the video track from index 1
    await client.publish([localTracks[0], localTracks[1]])
}

// joinStreamボタンを押した時に発火
let joinStream = async () => {
    await joinAndDisplayLocalStream()

    if (denoiser == null) {
        await setAIDenoiser()
    }
    document.getElementById('before-join').style.display = 'none'
    document.getElementById('stream-controls').style.display = 'flex'
}

/* 
we have events that we can listen for and functions that we can fire off whenever these events take place
when we call the publish method inside of the join and display local stream function this triggers an event called
on-user-published that other users can listen for so this means that when any other user calls the publish method all 
other users in that same channel can receive this call use that data from this event and publish that new user's
video stream inside of their local browser let's start building this out by creating a function that will fire off
 locally anytime another user joins the same channel that we're in we'll call
 */


let handleUserJoined = async (user, mediaType) => {
    if (user.uid === UIDShareScreen) {
        return
    }

    /*
    this function will contain a user and a media type for the parameters
     so when a user joins we will add them to the remote users object and set the key as their uid ant then set the user object so we can make sure that this is unique
    */
    remoteUsers[user.uid] = user 
    /*
      we will also subscribe our local client object to the newly added user's video and audio tracks so this is how we can receive their information
    */
    await client.subscribe(user, mediaType)

    // when the media type is video I want to create a new video player and publish it
    // if the user already has a video player we simply want to remove it and create a new one
    if (mediaType === 'video'){
        let player = document.getElementById(`user-container-${user.uid}`)
        if (player != null){
            player.remove()
        }
//  to store the remote user's video track just like we did earlier in the join and display local streams function
        player = `<div class="video-container" id="user-container-${user.uid}">
                        <div class="video-player" id="user-${user.uid}"></div> 
                 </div>`
        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)

        // referencing the user object we can access the video track attribute and call the play method to activate the video player
        user.videoTrack.play(`user-${user.uid}`)
    }

    if (mediaType === 'audio'){
        user.audioTrack.play()
    }
}

let handleUserLeft = async (user) => {
    if (user.uid === UIDShareScreen) {
        return
    }
    delete remoteUsers[user.uid]
    document.getElementById(`user-container-${user.uid}`).remove()
}

let leaveAndRemoveLocalStream = async () => {
    for(let i = 0; localTracks.length > i; i++){
        localTracks[i].stop()
        localTracks[i].close()
    }
    await client.leave()

    if(shareScreenClient) {
        localScreenTracks.stop()
        localScreenTracks.close()
        await shareScreenClient.leave()
        shareScreenClient = null
        localScreenTracks = []

        document.getElementById('screensharing').style.display = 'block'
        document.getElementById('closeScreensharing').style.display = 'none'
    }

    document.getElementById('mic-btn').innerText = 'Mic on'
    document.getElementById('mic-btn').style.backgroundColor = 'cadetblue'

    document.getElementById('camera-btn').innerText = 'Camera on'
    document.getElementById('camera-btn').style.backgroundColor = 'cadetblue'

    document.getElementById('before-join').style.display = 'block'
    document.getElementById('stream-controls').style.display = 'none'
    document.getElementById('video-streams').innerHTML = ''

    if (processor.enabled) {
        await processor.disable()
        document.getElementById('denoiser-btn').innerText = 'Play Denoiser'
        document.getElementById('denoiser-btn').style.backgroundColor = 'cadetblue'
    }

    // processor.ondump = (blob, name) => {
    //     // Dump the audio data to a local folder in WAV format
    //     const objectURL = URL.createObjectURL(blob);
    //     const tag = document.createElement("a");
    //     tag.download = name + ".wav";
    //     tag.href = objectURL;
    //     tag.click();
    //     }
        
        processor.ondumpend = () => {
        console.log("dump ended!!");
        }
        
        processor.dump();

}

let toggleMic = async (e) => {
    if (localTracks[0].muted){
        await localTracks[0].setMuted(false)
        e.target.innerText = 'Mic on'
        e.target.style.backgroundColor = 'cadetblue'
    }else{
        await localTracks[0].setMuted(true)
        e.target.innerText = 'Mic off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

let toggleCamera = async (e) => {
    if(localTracks[1].muted){
        await localTracks[1].setMuted(false)
        e.target.innerText = 'Camera on'
        e.target.style.backgroundColor = 'cadetblue'
    }else{
        await localTracks[1].setMuted(true)
        e.target.innerText = 'Camera off'
        e.target.style.backgroundColor = '#EE4B2B'
    }
}

let toggleShareScreen = async (e) => {
    if(shareScreenClient){
        await closeShareScreen(e)
    }else{
        await shareScreen(e)
    }
}

let toggleAIDenoiser = async (e) => {

    if (processor.enabled) {
    await processor.disable()
    e.target.innerText = 'Play Denoiser'
    e.target.style.backgroundColor = 'cadetblue'
} else {
    await processor.enable()
    e.target.innerText = 'Stop Denoiser'
    e.target.style.backgroundColor = '#EE4B2B'
    }
}


let shareScreen = async (e) => {
    shareScreenClient = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})
    
    // call the join method from the client object this method takes in all our app credentials and adds
    // our local user to the channel while returning back a uid
    UIDShareScreen = await shareScreenClient.join(APP_ID, CHANNEL, TOKEN, null)
    // if a uid is not specified one will be automatically generated so setting this value to null is fine


    // set the local tracks value that we created earlier to the return value of the create microphone and
    //  camera tracks method this method will prompt a local user to access their camera and audio
    // localTracks = await AgoraRTC.createMicrophoneAndCameraTracks() 
    // and hold these values inside of the local tracks variable

    // AgoraRTC.createScreenVideoTrack({
    //     // Set the encoder configurations. For details, see the API description.
    //     encoderConfig: "1080p_1",
    //   }).then(localScreenTrack => {
    //     /** ... **/
    //     localScreenTracks = localScreenTrack
    //   });

    //   const localScreenTracks = await AgoraRTC.createScreenVideoTrack();
      localScreenTracks = await AgoraRTC.createScreenVideoTrack();

    // once the video and audio tracks are created we need to create a place to display and store our stream
    // make sure that the parent container and child element both contain an id with the uid value from the user
    // because this is how we know which  dom elements to update once our element is created we will query the video
    // streams container and add in this new div into that container so it can be displayed

    
    let player = `<div class="video-container" id="user-container-${UIDShareScreen}">
                        <div class="video-player" id="user-${UIDShareScreen}"></div>
                  </div>`
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)


    /*
    the local tracks variable is now a list which holds the audio tracks in index 0 and the video track in 1
    call the play method which creates a video element and adds it inside of the html element which we specify by the id value

    */
    localScreenTracks.play(`user-${UIDShareScreen}`)
    // audioが0  videoが1

    // finally we call the client.publish method to take our local video and audio tracks and we publish them so every user that in this channel can hear and see us 
    // here we publish the audio track from index 0 and the video track from index 1
    // await client.publish([localTracks[0], localTracks[1]])
    await shareScreenClient.publish(localScreenTracks)



    // document.getElementById('screensharing').style.display = 'none'
    // document.getElementById('closeScreensharing').style.display = 'block'

    e.target.innerText = 'Stop SCREEN SHARING'
    e.target.style.backgroundColor = '#EE4B2B'

}

let closeShareScreen = async (e) => {
    // for(let i = 0; localTracks.length > i; i++){
    localScreenTracks.stop()
    localScreenTracks.close()
    // }
    // delete remoteUsers[user.uid]
    document.getElementById(`user-container-${UIDShareScreen}`).remove()

    await shareScreenClient.leave()
    // document.getElementById('join-btn').style.display = 'block'
    // document.getElementById('stream-controls').style.display = 'none'
    // document.getElementById('video-streams').innerHTML = ''

    shareScreenClient = null
    localScreenTracks = []

    e.target.innerText = 'SCREEN SHARING'
    e.target.style.backgroundColor = 'cadetblue'
    // document.getElementById('screensharing').style.display = 'block'
    // document.getElementById('closeScreensharing').style.display = 'none'
}

let setAIDenoiser = async () => {
   
    // Create an AIDenoiserExtension instance, and pass in the URL of the Wasm files
       // const denoiser = new AIDenoiserExtension({assetsPath:'./external'});
        denoiser = new AIDenoiserModule.AIDenoiserExtension({assetsPath:'./node_modules/agora-extension-ai-denoiser/external'})

        // Register the extension
        AgoraRTC.registerExtensions([denoiser])
        // (Optional) Listen for the callback reporting that the Wasm files fail to load
        denoiser.onloaderror = (e) => {
        // If the Wasm files fail to load, you can disable the plugin, for example:
        // openDenoiserButton.enabled = false;
            console.log("dnoiser onloaderror: ")
            console.log(e);
           
        }

    // Create a processor
    processor = denoiser.createProcessor();
    // Enable the extension by default
    // processor.enable();
    // Disable the extension by default
    processor.disable();
    // (Optional) Listen for the callback reporting that the noise reduction process takes too long
    processor.onoverload = async () => {
    console.log("overload!!!");
    // If noise reduction takes too long, turn off the extension
    await processor.disable();
    }


    // // Create a local video track
    // const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    // Inject the extension to the audio processing pipeline
    // audioTrack.pipe(processor).pipe(audioTrack.processorDestination);
    localTracks[0].pipe(processor).pipe(localTracks[0].processorDestination);
    // await processor.enable();

}


document.getElementById('join-btn').addEventListener('click', joinStream)
document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('screensharing-btn').addEventListener('click', toggleShareScreen)
document.getElementById('denoiser-btn').addEventListener('click', toggleAIDenoiser)
