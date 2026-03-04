# Design Document: Jan-Sahayak (Hybrid Edition)

## 1. Overview
Jan-Sahayak is a **Hybrid, Privacy-First AI Agent** designed to bridge the digital divide for India's rural population. It functions as a digital "Cyber Cafe Agent" that guides semi-literate users through government schemes (DPI).

**Core Philosophy:** "Zero-Knowledge Cloud Architecture."
1.  **The Vault (Local):** User PII (Aadhar, Land Records) is stored strictly on the client device (Mobile/Browser) using encrypted local storage.
2.  **The Brain (Cloud):** A stateless Python Monolith on AWS that provides intelligence (RAG) without ever persisting user data.

## 2. Technology Stack

| Layer | Component | Technology Choice | Justification |
| :--- | :--- | :--- | :--- |
| **Mobile App** | Frontend | **React Native (Expo)** | Cross-platform, OTA updates, Native Modules for Camera. |
| **Web App** | Frontend | **React + Vite** | High-performance PWA for users unwilling to install APKs. |
| **Local Store** | Storage | **MMKV** (Mobile) / **LocalStorage** (Web) | Synchronous, encrypted key-value storage for the "Personal Vault". |
| **Backend** | API | **Python FastAPI** | High-concurrency async monolith. |
| **Intelligence** | LLM | **AWS Bedrock (Claude 3 Haiku)** | Low latency, high reasoning capability for "Hinglish". |
| **Knowledge** | RAG | **AWS S3 + Lambda** | Stores scheme PDFs; Lambda parses rules dynamically. |
| **Auth/DB** | Public Data | **Supabase** | Handles non-sensitive auth and public scheme metadata. |

## 3. System Architecture

The system follows a **Hub-and-Spoke** model where the Python Backend acts as a stateless intelligence router.

```mermaid
graph TD
    %% Styling
    classDef private fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef public fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    classDef aws fill:#fff3e0,stroke:#e65100,stroke-width:2px;

    subgraph Client_Side ["🔒 Private Zone (Client Device)"]
        direction TB
        
        subgraph Mobile ["📱 React Native App"]
            UI_M[Expo UI]
            Vault_M[(MMKV Encrypted Store)]:::private
            Agent_M[WebView Injector]
        end
        
        subgraph Web ["💻 React Web PWA"]
            UI_W[Vite UI]
            Vault_W[(Browser LocalStorage)]:::private
        end
    end

    subgraph Cloud_Side ["☁️ Public Zone (Stateless)"]
        direction TB
        
        API[FastAPI Monolith]:::public
        
        subgraph AWS ["AWS Intelligence"]
            Bedrock[Amazon Bedrock<br/>(Claude 3 Haiku)]:::aws
            S3[S3 Bucket<br/>(Scheme PDFs)]:::aws
        end
        
        subgraph Data ["Public Data"]
            Supabase[(Supabase<br/>Auth & Metadata)]:::public
        end
    end

    %% Data Flow
    UI_M --> |"1. Query + Vault Context"| API
    UI_W --> |"1. Query + Vault Context"| API
    
    API --> |"2. RAG Retrieval"| S3
    API --> |"3. Inference Request"| Bedrock
    
    Bedrock --> |"4. Advice (Hinglish)"| API
    API --> |"5. Response"| UI_M
    API --> |"5. Response"| UI_W
    
    Agent_M -.-> |"Auto-Fill"| Vault_M