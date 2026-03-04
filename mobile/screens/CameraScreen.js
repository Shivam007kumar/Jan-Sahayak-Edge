import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/vision' : 'http://localhost:8000/api/vision';

export default function CameraScreen({ navigation, route }) {
    const { docType } = route.params || { docType: 'aadhar' };
    const [permission, requestPermission] = Camera.useCameraPermissions();
    const [isProcessing, setIsProcessing] = useState(false);
    const cameraRef = useRef(null);

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.centerContainer}>
                <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
                <Text style={styles.permissionText}>Jan-Sahayak needs camera access to scan your {docType}.</Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (cameraRef.current && !isProcessing) {
            setIsProcessing(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });

                // POST to Vision API
                const response = await axios.post(API_URL, {
                    image_base64: photo.base64,
                    doc_type: docType
                });

                const extractedData = response.data.data;

                // Save to AsyncStorage 
                await AsyncStorage.setItem(`${docType}_data`, JSON.stringify(extractedData));

                // Clear memory (implicit by unmounting and not storing base64 in state)

                // Navigate back with success param to trigger agent response
                navigation.navigate({
                    name: 'Agent',
                    params: { visionSuccess: true, docType: docType },
                    merge: true,
                });

            } catch (error) {
                console.error('Vision API Error:', error);
                alert('Failed to process document. Please try again.');
                setIsProcessing(false);
            }
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan {docType.toUpperCase()}</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.cameraContainer}>
                <CameraView style={styles.camera} ref={cameraRef} facing="back">
                    <View style={styles.overlay}>
                        <View style={styles.scanFrame} />
                        <Text style={styles.scanHint}>Align your {docType} within the frame</Text>
                    </View>
                </CameraView>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
                    onPress={takePicture}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="large" color="#138808" />
                    ) : (
                        <View style={styles.captureInner} />
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        padding: 32,
    },
    permissionText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#374151',
        marginVertical: 24,
        lineHeight: 24,
    },
    button: {
        backgroundColor: '#138808',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#000000',
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    cameraContainer: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        marginHorizontal: 16,
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 300,
        height: 200,
        borderWidth: 2,
        borderColor: '#34D399',
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    scanHint: {
        color: '#FFFFFF',
        marginTop: 24,
        fontSize: 14,
        fontWeight: '500',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    footer: {
        height: 120,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonDisabled: {
        backgroundColor: '#E5E7EB',
    },
    captureInner: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#000000',
    }
});
