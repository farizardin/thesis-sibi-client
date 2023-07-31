import { StyleSheet, Text, View, Button, SafeAreaView, TouchableOpacity, Dimensions, Modal, TextInput } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { Camera, CameraType } from 'expo-camera';
import { Video } from 'expo-av';
import { AntDesign } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import axios from 'axios';
import LoadingOverlay from './LoadingOverlay';
// import { Modal } from 'react-native-modal';
import { Icon } from 'react-native-elements';

// const SERVER_URL = 'http://192.168.0.37:1234/recognize/api';
export default function App() {
  let cameraRef = useRef();
  const [type, setType] = useState(CameraType.back);
  const [hasCameraPermission, setHasCameraPermission] = useState();
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState();
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [video, setVideo] = useState();
  const { height, width } = Dimensions.get('window');
  const [imagePadding, setImagePadding] = useState(0);
  const [ratio, setRatio] = useState('4:3');  // default is 4:3
  const screenRatio = height / width;
  const [isRatioSet, setIsRatioSet] =  useState(false)
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalErrorVisible, setErrorModalVisible] = useState(false);
  const [modalSettingVisible, setSettingModalVisible] = useState(false);
  const [predicted, setPredicted] = useState();
  const [normalizationElapsedTime, setNormalizationElapsedTime] = useState();
  const [predictionElapsedTime, setPredictionElapsedTime] = useState();
  const [totalProcessElapsedTime, setTotalProcessElapsedTime] = useState();
  const [requestElapsedTime, setRequestElapsedTime] = useState();
  const [errorMessage, setErrorMessage] = useState();
  const [SERVER_URL, setInputValue] = useState('http://192.168.54.78:1234/recognize/api');
  const [isLoading, setIsLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState();
  const actions = [
    { text: 'Capture', icon: <Icon name="camera" size={20} color="white" />, name: 'capture' },
    // Add more buttons as needed
  ];
  const handleMountError = (error) => {
    console.log('Camera mount error:', error);
    // Handle the error in an appropriate way
  };
  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const mediaLibraryPermission = await MediaLibrary.requestPermissionsAsync();
      const micStatus = await Camera.requestMicrophonePermissionsAsync();
      setHasCameraPermission(cameraPermission.status === "granted");
      setHasMediaLibraryPermission(mediaLibraryPermission.status === "granted");
      setHasMicrophonePermission(micStatus.status === "granted");
    })();
  }, []);

  useEffect(() => {
    let timer = null;
    if(isActive){
      timer = setInterval(() => {
        setSeconds((seconds) => seconds + 1);
      }, 1000);
    }
    return () => {
      clearInterval(timer);
    };
  });

  const prepareRatio = async () => {
    let desiredRatio = '16:9';  // Start with the system default
    // This issue only affects Android
    if (Platform.OS === 'android') {
      const ratios = await cameraRef.current.getSupportedRatiosAsync();

      // Calculate the width/height of each of the supported camera ratios
      // These width/height are measured in landscape mode
      // find the ratio that is closest to the screen ratio without going over
      let distances = {};
      let realRatios = {};
      let minDistance = null;
      for (const ratio of ratios) {
        const parts = ratio.split(':');
        const realRatio = parseInt(parts[0]) / parseInt(parts[1]);
        realRatios[ratio] = realRatio;
        // ratio can't be taller than screen, so we don't want an abs()
        const distance = screenRatio - realRatio; 
        distances[ratio] = realRatio;
        if (minDistance == null) {
          minDistance = ratio;
        } else {
          if (distance >= 0 && distance < distances[minDistance]) {
            minDistance = ratio;
          }
        }
      }
      // set the best match
      desiredRatio = minDistance;
      //  calculate the difference between the camera width and the screen height
      const remainder = Math.floor(
        (height - realRatios[desiredRatio] * width) / 2
      );
      // set the preview padding and preview ratio
      setImagePadding(remainder / 2);
      setRatio(desiredRatio);
      // Set a flag so we don't do this 
      // calculation each time the screen refreshes
      setIsRatioSet(true);
    }
  };

  // the camera must be loaded in order to access the supported ratios
  const setCameraReady = async() => {
    if (!isRatioSet) {
      await prepareRatio();
    }
  };

  if (hasCameraPermission === undefined) {
    return <Text>Requestion permissions...</Text>
  } else if (!hasCameraPermission) {
    return <Text>Permission for camera not granted.</Text>
  }

  let recordVideo = () => {
    setIsActive(true);
    setIsRecording(true);
    let options = {
      quality: "1080p",
      maxDuration: 60,
      mute: false
    };

    cameraRef.current.recordAsync(options).then((recordedVideo) => {
      setVideo(recordedVideo);
      setIsRecording(false);
    });
  };

  let stopRecording = () => {
    setSeconds(0);
    setIsActive(false);
    setIsRecording(false);
    cameraRef.current.stopRecording();
  };

  const handleInputChange = (text) => {
    setInputValue(text);
  };

  function error_handler(error){
    setIsLoading(false);
    if (error.response) {
      // The request was made and the server responded with a status code outside the range of 2xx
      if (error.response.status === 422) {
        // Handle specific 422 error
        var message = error.response.data.error.message;
      } else if (error.response.status === 500) {
        // Handle specific 500 error
        var message = error.response.data.error.message;
      } else {
        // Handle other error statuses
        var message = error.response.status;
      }
    } else if (error.request) {
      // The request was made but no response was received
      var message = error.request._response;
    } else {
      // Something happened in setting up the request that triggered an Error
      var message = error.error.message;
    }
    setErrorMessage(message);
    setErrorModalVisible(true)
  }

  const uploadVideo = async () => {
    if (video) {
      const formData = new FormData();
      formData.append('video', {
        uri: video.uri,
        type: 'video/mp4',
        name: 'video.mp4',
      });
      var headers = {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
      setIsLoading(true);

      try {
        // const videoUri = video.uri
        var request_start_at = performance.now();
        var response = await axios.post(SERVER_URL, formData, headers);
        var request_end_at = performance.now();

        var request_elapsed_time = ((request_end_at - request_start_at) / 1000).toFixed(2);
        setIsLoading(false);
        setModalVisible(true);
        setPredicted(response.data.data.predicted);
        setNormalizationElapsedTime(response.data.data.normalization_elapsed_time);
        setPredictionElapsedTime(response.data.data.prediction_elapsed_time);
        setTotalProcessElapsedTime(response.data.data.total_process_elapsed_time);
        setRequestElapsedTime(request_elapsed_time);
        setVideoDuration(response.data.data.video_duration);
      } catch (error) {
        error_handler(error);
      }
    }
  };

  function toggleCameraType() {
    setType(current => (current === CameraType.back ? CameraType.front : CameraType.back));
  }

  if (video) {
    let saveVideo = () => {
      MediaLibrary.saveToLibraryAsync(video.uri).then(() => {
        setVideo(undefined);
      });
    };

    return (
      <View style={styles.videoContainer} onMountError={handleMountError}>
        <View style={styles.video} onMountError={handleMountError}>
          <Video
            style={styles.video}
            source={{uri: video.uri}}
            useNativeControls
            resizeMode='contain'
            isLooping
          />
        </View>
        <View style={styles.videoNavigation}>
          <Button title="Unggah dan Kenali" onPress={uploadVideo} />
          <Button color="darkred" title="Batal" onPress={() => setVideo(undefined)} />
          {/* <TouchableOpacity  style={styles.videoButtonNavigation} onPress={uploadVideo}>
            <AntDesign name="upload" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.videoButtonNavigation} onPress={uploadVideo}>
            <AntDesign name="close" size={24} color="#fff" />
          </TouchableOpacity> */}
        </View>
        <LoadingOverlay isVisible={isLoading} />
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer} onMountError={handleMountError}>
            <View style={styles.modalContent} onMountError={handleMountError}>
              <Text style={styles.modalText}>Hasil</Text>
              <Text style={styles.modalContentTextHeader}>Prediksi Kata/Kalimat:</Text>
              <Text style={styles.modalContentText}>{predicted}</Text>
              <Text style={styles.modalContentTextHeader}>Durasi Video:</Text>
              <Text style={styles.modalContentText}>{videoDuration} Detik</Text>
              <Text style={styles.modalContentTextHeader}>Durasi Normalisasi:</Text>
              <Text style={styles.modalContentText}>{normalizationElapsedTime} Detik</Text>
              <Text style={styles.modalContentTextHeader}>Durasi Prediksi:</Text>
              <Text style={styles.modalContentText}>{predictionElapsedTime} Detik</Text>
              <Text style={styles.modalContentTextHeader}>Total Durasi Pemrosesan:</Text>
              <Text style={styles.modalContentText}>{totalProcessElapsedTime} Detik</Text>
              <Text style={styles.modalContentTextHeader}>Durasi Permintaan:</Text>
              <Text style={styles.modalContentText}>{requestElapsedTime} Detik</Text>
              <Button title="Tutup" onPress={() => setModalVisible(false)} />
            </View>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalErrorVisible}
          onRequestClose={() => setErrorModalVisible(false)}
        >
          <View style={styles.modalContainer} onMountError={handleMountError}>
            <View style={styles.modalContent} onMountError={handleMountError}>
              <Text style={styles.modalText}>Terjadi Kesalahan</Text>
              <Text style={{ fontSize: 17 }}>
                <Text style={{ fontWeight: 'bold' }}>Pesan : </Text>
                <Text>{errorMessage}</Text>
              </Text>
              <Button title="Tutup" onPress={() => setErrorModalVisible(false)} />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container} onMountError={handleMountError}>
      <Camera
        onCameraReady={setCameraReady}
        onMountError={handleMountError}
        type={type}
        ratio={ratio}
        style={[styles.container, { marginBottom: imagePadding * 4}]}
        ref={cameraRef}
      />
      <View style={[styles.controls, {marginBottom: imagePadding }]} onMountError={handleMountError}>
      <Text style={styles.buttonText}>
        {seconds}
      </Text>
        <TouchableOpacity style={styles.button} onPress={toggleCameraType}>
            <Text style={styles.text}>Pindah Kamera</Text>
          </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={isRecording ? stopRecording : recordVideo}
        >
          <Text style={styles.buttonText}>
            {isRecording ? "Stop Perekaman" : "Rekam Video"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity  style={styles.floatingButton} onPress={() => setSettingModalVisible(true)}>
          <AntDesign name="setting" size={24} color="#fff" />
        </TouchableOpacity>
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalSettingVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer} onMountError={handleMountError}>
            <View style={styles.modalContent} onMountError={handleMountError}>
              <Text style={styles.modalText}>Pengaturan</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Enter endpoint"
                value={SERVER_URL}
                onChangeText={handleInputChange}
              />
              <Button style={{marginTop: 'auto'}} title="Tutup" onPress={() => setSettingModalVisible(false)} />
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  button: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 10,
  },
  preview_button: {
    padding: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 10,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    width: '80%', // Adjust the width as desired
    borderRadius: 8,
  },
  modalText: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  modalContentText: {
    fontSize: 17,
    marginBottom: 10,
  },
  modalContentTextHeader: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoNavigation: {
    position: 'absolute',
    bottom: '12%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    justifyContent: 'space-between',
    marginHorizontal: 50,
  },
  videoButtonNavigation: {
    borderRadius: 30,
    backgroundColor: '#007AFF',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  }
});