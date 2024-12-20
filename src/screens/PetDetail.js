import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  Dimensions,
  Keyboard,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  deleteDoc,

} from 'firebase/firestore';

import { auth, storage, firestore } from '../configs/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Checkbox from '../components/checkbox';
import CryptoJS from 'rn-crypto-js';
import Keymanagement from '../components/Keymanagement';

const PetDetail = () => {
  const db = getFirestore();
  const user = auth.currentUser;
  const [userData, setUserData] = useState(null);
  const [pet, setPet] = useState({
    name: '',
    age: '',
    breeds: '',
    weight: '',
    height: '',
    gender: '',
    color: '',
    characteristics: '',
    birthday: '',
    adoptingConditions: '',
    additionalImages: [],
  });
  const [isFindHomeChecked, setIsFindHomeChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [additionalImages, setAdditionalImages] = useState([]);
  const route = useRoute();
  const [image, setImage] = useState('');
  const { id } = route.params;
  const navigation = useNavigation();
  const KeymanagementInstance = new Keymanagement();
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' },
      });
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: [styles.tabBar, { backgroundColor: '#F0DFC8' }],
      });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [navigation]);
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' },
      });

      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: [styles.tabBar, { backgroundColor: '#F0DFC8' }],
        });
      };
    }, [navigation]),
  );
  useEffect(() => {
    if (!user) return;

    const userDoc = doc(firestore, 'Users', user.uid);

    const unsubscribe = onSnapshot(
      userDoc,
      docSnap => {
        if (docSnap.exists() && docSnap.data().email === user.email) {
          setUserData(docSnap.data());
        } else {
          console.log('No matching user data found');
        }
        setLoading(false);
      },
      error => {
        console.error('Error fetching user data:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  const fetchUsername = async uid => {
    const userDocRef = doc(db, 'Users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data().username;
    } else {
      console.error('No such user document!');
      return '';
    }
  };

  const fetchPet = async () => {
    const key = await KeymanagementInstance.retrievemasterkey();
    try {
      const petDocRef = doc(db, 'Pets', id);
      const petDoc = await getDoc(petDocRef);
      if (petDoc.exists()) {
        let petData = petDoc.data() || {};
        if (petData.status === 'have_owner') {
          petData = decryptPetData(petData, key);
        }
        setPet(petData);
      } else {
        setError('Pet not found');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const decryptPetData = (petData, key) => {
    return {
      ...petData,
      age: petData.age
        ? CryptoJS.AES.decrypt(petData.age, key).toString(CryptoJS.enc.Utf8)
        : '',
      breeds: petData.breeds ? petData.breeds : '',
      weight: petData.weight
        ? CryptoJS.AES.decrypt(petData.weight, key).toString(CryptoJS.enc.Utf8)
        : '',
      height: petData.height
        ? CryptoJS.AES.decrypt(petData.height, key).toString(CryptoJS.enc.Utf8)
        : '',
      characteristics: petData.characteristics
        ? CryptoJS.AES.decrypt(petData.characteristics, key).toString(
            CryptoJS.enc.Utf8,
          )
        : '',
      color: petData.color
        ? CryptoJS.AES.decrypt(petData.color, key).toString(CryptoJS.enc.Utf8)
        : '',
      gender: petData.gender
        ? CryptoJS.AES.decrypt(petData.gender, key).toString(CryptoJS.enc.Utf8)
        : '',
      birthday: petData.birthday
        ? CryptoJS.AES.decrypt(petData.birthday, key).toString(
            CryptoJS.enc.Utf8,
          )
        : '',
      additionalImages: petData.additionalImages || [],
    };
  };

  useEffect(() => {
    fetchPet();
  }, [id]);

  const handleSave = async imageToDelete => {
    try {
      if (!user) {
        console.error('No user is currently logged in.');
        return;
      }

      const dateTime = Timestamp.now();
      const username = await fetchUsername(user.uid);
      const key = await KeymanagementInstance.retrievemasterkey();

      if (!username) return;
      if (!pet.name) {
        Alert.alert('Error', 'Pet name cannot be empty.');
        return;
      }

      const dataToStore = prepareDataToStore(key);

      await savePetData(dataToStore);
      navigation.goBack();
    } catch (err) {
      setError(err.message);
      console.error('Error saving pet data:', err);
    }
  };

  const prepareDataToStore = key => {
    const {
      name = '',
      age = '',
      breeds = '',
      weight = '',
      height = '',
      characteristics = '',
      color = '',
      gender = '',
      birthday,
      adoptingConditions = '',
    } = pet;

    let dataToStore;

    if (isFindHomeChecked) {
      dataToStore = {
        ...pet,
        name: name.trim(),
        age,
        breeds,
        weight,
        height,
        characteristics,
        color,
        gender,
        birthday,
        adoptingConditions,
        updatedAt: Timestamp.now(),
      };
    } else {
      dataToStore = {
        ...pet,
        name: name.trim(),
        age: age ? CryptoJS.AES.encrypt(String(age), key).toString() : null,
        breeds: breeds ? breeds : null,
        weight: weight
          ? CryptoJS.AES.encrypt(String(weight), key).toString()
          : null,
        height: height
          ? CryptoJS.AES.encrypt(String(height), key).toString()
          : null,
        characteristics: characteristics
          ? CryptoJS.AES.encrypt(String(characteristics), key).toString()
          : null,
        color: color
          ? CryptoJS.AES.encrypt(String(color), key).toString()
          : null,
        gender: gender
          ? CryptoJS.AES.encrypt(String(gender), key).toString()
          : null,
        birthday: birthday
          ? CryptoJS.AES.encrypt(birthday, key).toString()
          : null,
        updatedAt: Timestamp.now(),
      };
    }

    Object.keys(dataToStore).forEach(key => {
      if (dataToStore[key] === undefined) {
        delete dataToStore[key];
      }
    });

    return dataToStore;
  };

  const savePetData = async dataToStore => {
    const petDocRef = doc(db, 'Pets', pet.id.trim());
    const petDoc = await getDoc(petDocRef);
    if (!petDoc.exists()) {
      Alert.alert('Error', 'Pet document does not exist.');
      return;
    }

    await updateDoc(petDocRef, dataToStore);
  };

  useEffect(() => {
    if (pet?.status === 'dont_have_owner') {
      setIsFindHomeChecked(true);
    }
  }, [pet]);

  const onPress = () => {
    setIsFindHomeChecked(!isFindHomeChecked);
    setPet(prevPet => ({
      ...prevPet,
      status: !isFindHomeChecked ? 'dont_have_owner' : 'have_owner',
    }));
  };

  const handleDelete = async () => {
    Alert.alert('Delete Pet', 'Are you sure you want to delete this pet?', [
      {
        text: 'Yes',
        onPress: () => {
          (async () => {
            try {
              await deletePet();
              navigation.navigate('MyPets');
            } catch (error) {
              console.error('Error deleting pet:', error);
            }
          })();
        },
      },
      {
        text: 'No',
        style: 'cancel',
      },
    ]);
  };

  const deletePet = async () => {
    try {
      const petDocRef = doc(firestore, 'Pets', pet.id);
      await deleteDoc(petDocRef);
    } catch (error) {
      console.error('Error deleting pet:', error);
    }
  };
  const pickImage = () => {
    Alert.alert('Select Image', 'Choose an option', [
      {
        text: 'Camera',
        onPress: () => {
          openCamera();
        },
      },
      {
        text: 'Gallery',
        onPress: () => {
          openImageLibrary();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openImageLibrary = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      uploadImage(result.assets[0].uri);
    }
  };

  const openCamera = async () => {
    const result = await launchCamera({ mediaType: 'photo', quality: 1 });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async uri => {
    if (!uri) return;

    setUploading(true);
    const storageRef = ref(
      storage,
      `images/${user.uid}/pets/${pet.name}/${Date.now()}`,
    );
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error('Blob is empty');
      }

      const snapshot = await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const petDocRef = doc(db, 'Pets', id);

      await updateDoc(petDocRef, {
        photoURL: downloadURL,
      });

      setPet(prevState => ({
        ...prevState,
        additionalImages: [...(prevState.additionalImages || []), downloadURL],
      }));

      Alert.alert('Success', 'Additional image uploaded successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      console.error('Error uploading image: ', error);
    } finally {
      setUploading(false);
    }
  };

  const pickAdditionalImages = () => {
    Alert.alert('Select Images', 'Choose an option', [
      {
        text: 'Camera',
        onPress: () => {
          openCameraForAdditionalImages();
        },
      },
      {
        text: 'Gallery',
        onPress: () => {
          openImageLibraryForAdditionalImages();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openImageLibraryForAdditionalImages = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1, selectionLimit: 0 });
    if (!result.canceled) {
      const newImageUris = result.assets.map(asset => asset.uri);
      setAdditionalImages(prevImages => [...prevImages, ...newImageUris]);
      newImageUris.forEach(uri => uploadAdditionalImages(uri));
    }
  };

  const openCameraForAdditionalImages = async () => {
    const result = await launchCamera({ mediaType: 'photo', quality: 1 });
    if (!result.canceled) {
      const newImageUri = result.assets[0].uri;
      setAdditionalImages(prevImages => [...prevImages, newImageUri]);
      uploadAdditionalImages(newImageUri);
    }
  };

  const uploadAdditionalImages = async uri => {
    if (!uri) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `images/${user.uid}/pets/${pet.name}/additional/${Date.now()}`);
      const response = await fetch(uri);
      const blob = await response.blob();
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setPet(prevState => {
        if (!prevState) return { additionalImages: [downloadURL] };
        return {
          ...prevState,
          additionalImages: [...(prevState.additionalImages || []), downloadURL],
        };
      });

    } catch (error) {
      console.error('Error uploading Additional image:');
      console.error('Error uploading image: ', error);
    } finally {
      setUploading(false);
    }
  };

  const fetchAdditionalImages = async () => {
    try {
      const petDocRef = doc(db, 'Pets', id);
      const docSnap = await getDoc(petDocRef);

      if (docSnap.exists()) {
        const petData = docSnap.data();
        setAdditionalImages(petData.additionalImages || []);
      } else {
        console.log('No such document!');
      }
    } catch (error) {
      console.error('Error fetching additional images: ', error);
    }
  };

  useEffect(() => {
    fetchAdditionalImages();
  }, []);
  const handleDeleteAdditionalImage = async index => {
    const updatedImages = additionalImages.filter((_, i) => i !== index);
    try {
      const petDocRef = doc(db, 'Pets', id);
      await updateDoc(petDocRef, {
        additionalImages: updatedImages,
      });
      setAdditionalImages(updatedImages);
    } catch (error) {
      console.error('Error deleting additional image: ', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return <Text>Error: {error}</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          style={styles.back}
          name="arrow-left"
          size={35}
          color="#D27C2C"
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.screenTitle}>Edit Pet Profile</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        style={styles.container}>
        {pet?.photoURL ? (
          <Image source={{ uri: pet.photoURL }} style={styles.image} />
        ) : (
          <MaterialCommunityIcons name="account" size={50} color="gray" />
        )}
        <TouchableOpacity onPress={pickImage}>
          <View style={styles.Change}>
            <Text style={{ color: 'black', fontSize: 12 }}>Change</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.subContainer}>
          <View style={styles.whContainer}>
            <View style={styles.containerwh}>
              <Text style={styles.field}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={pet?.name || ''}
                onChangeText={text => setPet({ ...pet, name: text })}
              />
            </View>
            <View style={styles.containerwh}>
              <Text>Age</Text>
              <TextInput
                style={styles.inputwh}
                placeholder="Age"
                placeholderTextColor={'gray'}
                value={pet.age || ''}
                editable={false}
              />
            </View>
          </View>
          <View style={styles.whContainer}>
            <View style={styles.containerwh}>
              <Text style={styles.field}>Type</Text>
              <TextInput
                style={styles.inputwh}
                value={pet?.type || ''}
                editable={false}
              />
            </View>
            <View style={styles.containerwh}>
              <Text style={styles.field}>Birthday</Text>
              <TextInput
                style={styles.inputwh}
                value={pet?.birthday || ''}
                editable={false}
              />
            </View>
          </View>
          <Text style={styles.field}>Breeds</Text>
          <TextInput
            style={styles.input}
            placeholder="Breed"
            value={pet?.breeds || ''}
            onChangeText={text => setPet({ ...pet, breeds: text })}
          />

          <View style={styles.whContainer}>
            <View style={styles.containerwh}>
              <Text style={styles.field}>Weight</Text>
              <TextInput
                style={styles.inputwh}
                placeholder="Weight (grams)"
                keyboardType="numeric"
                value={pet?.weight ? `${pet.weight}` || '' : ''}
                onChangeText={text =>
                  setPet({ ...pet, weight: parseFloat(text) })
                }
              />
            </View>
            <View style={styles.containerwh}>
              <Text style={styles.field}>Height</Text>
              <TextInput
                style={styles.inputwh}
                placeholder="Height (cm)"
                keyboardType="numeric"
                value={pet?.height ? `${pet.height}` || '' : ''}
                onChangeText={text =>
                  setPet({ ...pet, height: parseFloat(text) })
                }
              />
            </View>
          </View>
          <View style={styles.whContainer}>
            <View style={styles.containerwh}>
              <Text style={styles.field}>Color</Text>
              <TextInput
                style={styles.inputwh}
                placeholder="Color"
                value={pet?.color ? `${pet.color}` || '' : ''}
                onChangeText={text => setPet({ ...pet, color: text })}
              />
            </View>
            <View style={styles.containerwh}>
              <Text style={styles.field}>Gender</Text>
              <TextInput
                style={styles.inputwh}
                placeholder="Gender"
                value={pet?.gender ? `${pet.gender}` || '' : ''}
                editable={false}
              />
            </View>
          </View>
          <View style={styles.whContainer}>
            <View style={styles.container}>
              <Text style={styles.field}>Characteristics</Text>
              <TextInput
                style={styles.inputwh}
                placeholder="Characteristics"
                value={
                  pet?.characteristics ? `${pet.characteristics}` || '' : ''
                }
                onChangeText={text => setPet({ ...pet, characteristics: text })}
              />
            </View>
          </View>

          <View style={styles.additionalImagesContainer}>
            {additionalImages.length > 0 ? (
              <>
                {additionalImages.map((uri, index) => (
                  <View key={index} style={styles.additionalImageWrapper}>
                    <Image
                      key={index}
                      source={{ uri }}
                      style={styles.additionalImage}
                    />
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteAdditionalImage(index)}>
                      <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color="red"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.AdditionalBox}>
                  <TouchableOpacity
                    style={[styles.additionalImagePicker, styles.fixedAddImagesButton]}
                    onPress={pickAdditionalImages}>
                    <Text style={styles.additionalImagePickerText}>
                      Add Images
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.additionalContainerNo}>
                <TouchableOpacity
                  style={styles.additionalImagePicker}
                  onPress={pickAdditionalImages}>
                  <Text style={styles.additionalImagePickerText}>
                    Add Images
                  </Text>
                </TouchableOpacity>
                <Text>No additional images available.</Text>
              </View>
            )}
          </View>
          {userData?.verify ? (
            <>
              <Checkbox
                text="Find Home"
                onPress={onPress}
                value={pet?.status ? `${pet.status}` || '' : ''}
                isChecked={isFindHomeChecked}
              />

              {isFindHomeChecked && (
                <View style={styles.adoptionDetailsContainer}>
                  <Text style={styles.field}>Adopting Conditions</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Adopting Conditions"
                    value={pet?.adoptingConditions || ''}
                    onChangeText={
                      text =>
                        setPet(prevPet => ({
                          ...prevPet,
                          adoptingConditions: text,
                        }))
                    }
                  />

                </View>
              )}
            </>
          ) : null}
        </View>
        <View style={styles.buttonPanel}>
          <TouchableOpacity style={styles.buttonS} onPress={() => handleSave()}>
            <Text>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buttonD}
            onPress={() => handleDelete()}>
            <Text>Delete</Text>
          </TouchableOpacity>
        </View>
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
        {uploading && <ActivityIndicator size="small" color="#0000ff" />}
      </ScrollView>
    </View>
  );
};
const { width } = Dimensions.get('window');

const titleSize = width / 17;
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 80,
    flexGrow: 1,
    paddingBottom: 80,
    alignItems: 'center',
  },
  subContainer: {
    width: '100%',
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 20,
  },
  whContainer: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  containerwh: {
    width: '45%',
    backgroundColor: '#fff',
    marginHorizontal: 17,
  },
  input: {
    fontFamily: 'InterRegular',
    width: '100%',
    padding: 10,
    marginTop: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    color: 'black',
  },
  inputwh: {
    fontFamily: 'InterRegular',
    width: '100%',
    padding: 10,
    marginTop: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
  },
  inputDate: {
    width: '90%',
    padding: 10,
    marginTop: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
  },
  errorText: {
    color: 'red',
    marginTop: 10,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 100,
    borderWidth: 2,
  },
  camera: {
    padding: 5,
    backgroundColor: '#F0DFC8',
    borderRadius: 50,
    position: 'absolute',
    top: -30,
    left: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    padding: 10,
  },
  buttonPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '60%',
  },
  buttonS: {
    width: '40%',
    backgroundColor: '#F0DFC8',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonD: {
    width: '40%',
    backgroundColor: '#F0DFC8',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  adoptionDetailsContainer: {
    marginTop: 20,
  },
  header: {
    width: '100%',
    height: '8%',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },

  back: {
    position: 'absolute',
    left: 20,
  },
  screenTitle: {
    fontSize: titleSize,
    fontFamily: 'InterBold',
    color: '#D27C2C',
    paddingTop: 5,
  },
  field: {
    fontFamily: 'InterRegular',
  },
  additionalImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    borderColor: '#ddd',
    marginVertical: 10,
  },
  additionalImagePicker: {
    backgroundColor: '#F0DFC8',
    padding: 10,
    borderRadius: 10,
    margin: 10,
  },
  additionalContainerNo: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  additionalImagePickerText: {
    fontFamily: 'InterRegular',
  },
  fixedAddImagesButton: {
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    width: '30%',
  },
  AdditionalBox: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    backgroundColor: '#fff',
  },
  additionalImage: {
    width: 100,
    height: 100,
    margin: 10,
    borderRadius: 10,
  },

  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F0DFC8',
    borderRadius: 10,
    padding: 5,
  },
  tabBar: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '8%',
    position: 'absolute',
    overflow: 'hidden',
  },
});

export default PetDetail;
