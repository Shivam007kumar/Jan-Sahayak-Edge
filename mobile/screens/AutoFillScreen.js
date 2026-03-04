import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AutoFillScreen({ navigation }) {
    const [showVerification, setShowVerification] = useState(false);
    const [extractedData, setExtractedData] = useState({ name: '', id_number: '' });
    const webViewRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const savedDataStr = await AsyncStorage.getItem('aadhar_data');
                if (savedDataStr) {
                    setExtractedData(JSON.parse(savedDataStr));
                }
            } catch (e) {
                console.error('AsyncStorage parse error:', e);
            }
        };
        loadData();
    }, []);

    const jsCodeToInject = `
    setTimeout(function() {
      // Attempt to auto-fill common mock fields smoothly. 
      // NOTE: We do NOT auto-click 'submit'.
      const nameField = document.querySelector('input[name="farmer_name"]') || document.querySelector('input[type="text"]');
      const aadharField = document.querySelector('input[name="aadhar_number"]') || document.querySelectorAll('input[type="text"]')[1];
      
      if (nameField) {
        nameField.value = '${extractedData.name || 'Ramesh Kumar'}';
        nameField.style.borderColor = '#138808';
        nameField.style.borderWidth = '2px';
      }
      
      if (aadharField) {
        aadharField.value = '${extractedData.id_number || 'XXXX-XXXX-1234'}';
        aadharField.style.borderColor = '#138808';
        aadharField.style.borderWidth = '2px';
      }
      
      window.ReactNativeWebView.postMessage('INJECTION_COMPLETE');
    }, 1500);
    true;
  `;

    const onMessage = (event) => {
        if (event.nativeEvent.data === 'INJECTION_COMPLETE') {
            // Slide up the Verification Bottom Sheet after filling
            setTimeout(() => {
                setShowVerification(true);
                Speech.speak('Kripya apne details verify karein.', { language: 'hi-IN', rate: 0.9 });
            }, 1000);
        }
    };

    const handleManualEdit = () => {
        setShowVerification(false);
        // User stays on the WebView to manually type/correct
        Speech.stop();
    };

    const handleConfirmSubmit = () => {
        setShowVerification(false);
        Speech.stop();
        // Inject JS to actually find and click the submit button
        const submitCode = `
      const submitBtn = document.querySelector('button[type="submit"]') || document.querySelector('.submit-btn');
      if (submitBtn) submitBtn.click();
      true;
    `;
        webViewRef.current?.injectJavaScript(submitCode);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* Fake Browser Address Bar */}
            <View style={styles.addressBar}>
                <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.navigate('Agent')}>
                    <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
                <View style={styles.urlContainer}>
                    <Ionicons name="lock-closed" size={14} color="#059669" style={{ marginRight: 6 }} />
                    <Text style={styles.urlText}>https://pmkisan.gov.in/registration</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {/* Embedded web portal */}
            <WebView
                ref={webViewRef}
                source={{ uri: 'https://formsmash.com/mock-gov-form' }} // Replace with actual portal URL if needed
                injectedJavaScript={jsCodeToInject}
                onMessage={onMessage}
                javaScriptEnabled={true}
                style={styles.webview}
            />

            {/* Verification Modal (Responsible AI) */}
            <Modal
                visible={showVerification}
                animationType="slide"
                transparent={true}
                onRequestClose={handleManualEdit}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>

                        <View style={styles.modalHeader}>
                            <Ionicons name="warning" size={24} color="#D97706" />
                            <Text style={styles.modalTitle}>Verification Required</Text>
                        </View>

                        <Text style={styles.modalWarningText}>
                            Please check all values, names, and numbers carefully. You are responsible for the accuracy of this government application.
                        </Text>

                        <View style={styles.dataPreviewBox}>
                            <View style={styles.dataRow}>
                                <Text style={styles.dataLabel}>Applicant Name:</Text>
                                <Text style={styles.dataValue}>{extractedData.name || 'Ramesh Kumar'}</Text>
                            </View>
                            <View style={styles.dataRow}>
                                <Text style={styles.dataLabel}>Aadhaar Number:</Text>
                                <Text style={styles.dataValue}>{extractedData.id_number || 'XXXX-XXXX-1234'}</Text>
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.editButton} onPress={handleManualEdit}>
                                <Text style={styles.editButtonText}>Edit Manually</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmSubmit}>
                                <Text style={styles.confirmButtonText}>Confirm & Submit</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    addressBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    closeBtn: {
        padding: 4,
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        flex: 1,
        marginHorizontal: 12,
    },
    urlText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    webview: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginLeft: 8,
    },
    modalWarningText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
        marginBottom: 20,
    },
    dataPreviewBox: {
        backgroundColor: '#FEF3C7', // Yellow warning tint
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    dataRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    dataLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400E',
    },
    dataValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#92400E',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    editButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    editButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: 'bold',
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#138808',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
