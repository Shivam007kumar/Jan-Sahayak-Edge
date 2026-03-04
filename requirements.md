---

### File 2: `requirements.md`

```markdown
# Requirements Document: Jan-Sahayak

## 1. Introduction
Jan-Sahayak is a **Hybrid AI Platform** (Mobile & Web) that acts as a personal digital assistant for accessing Indian Government services. It solves the "Last Mile" problem by combining a **Local-First Data Vault** with a **Cloud-Based Intelligence Engine**.

## 2. Functional Requirements

### Requirement 1: The Secure Local Vault
**User Story:** As a user, I want to store my documents on my phone/browser so that I don't have to upload sensitive data to a server I don't trust.
*   **AC 1.1:** The Mobile App MUST use `MMKV` for encrypted key-value storage.
*   **AC 1.2:** The Web App MUST use `LocalStorage` for session-based persistence.
*   **AC 1.3:** The system MUST NOT transmit full document files to the backend; only metadata (e.g., "I have Aadhar") is sent for context.

### Requirement 2: The "Cyber Cafe" Conversational Agent
**User Story:** As a semi-literate user, I want to ask questions in Hinglish (e.g., "Is this scheme for me?") and get accurate answers based on the documents I actually own.
*   **AC 2.1:** The Backend MUST use **AWS Bedrock (Claude 3 Haiku)** for natural language processing.
*   **AC 2.2:** The Agent MUST identify "Missing Documents" (Gap Analysis) based on the user's Vault status.
*   **AC 2.3:** The response latency MUST be under 2 seconds.

### Requirement 3: Automated Form Filling (Mobile Only)
**User Story:** As a user, I want the app to type my details into the government website automatically so that I don't make spelling mistakes.
*   **AC 3.1:** The Mobile App MUST implement a Custom Browser using `react-native-webview`.
*   **AC 3.2:** The app MUST support JavaScript injection to map Vault data (Aadhar, Name) to HTML Input IDs.
*   **AC 3.3:** The app MUST highlight the "Submit" button only when validation passes.

### Requirement 4: Multi-Modal Document Ingestion
**User Story:** As a user, I want to verify that I have a document by taking a photo of it.
*   **AC 4.1:** The Mobile App MUST use `react-native-vision-camera`.
*   **AC 4.2:** The app MUST simulate verification (Mock OCR) for the prototype, flagging the document as `verified: true` in the Vault upon capture.

### Requirement 5: Scheme Validity Check
**User Story:** As a user, I want to know if a viral message about "Free Money" is real or fake.
*   **AC 5.1:** The system MUST cross-reference user queries against the **Amazon S3 Knowledge Base** of official scheme guidelines.
*   **AC 5.2:** The Agent MUST return a "Confidence Score" (Real/Fake/Unsure) for scheme queries.

## 3. Non-Functional Requirements

### Performance
*   **App Startup:** < 1 second (via React Native Expo).
*   **API Latency:** < 500ms (FastAPI Async implementation).
*   **Build Size:** < 30MB APK.

### Privacy (Critical)
*   **Zero-Knowledge Architecture:** The backend server MUST be stateless regarding User PII. No database table shall exist for storing User Documents.

### Compatibility
*   **Mobile:** Android 8.0+ (covering 92% of Indian devices).
*   **Web:** Chrome, Safari, and Edge (Mobile & Desktop).

## 4. Interface Specifications

### 4.1 API Contract (Python Backend)
**POST** `/api/chat`
```json
{
  "query": "Apply for PM Kisan",
  "vault_context": ["AADHAR", "LAND_RECORD_7_12"],
  "language_pref": "hi-IN"
}