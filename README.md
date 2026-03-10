RecallAI – Context-Aware Event Extraction and Memory Assistant
Project Overview
RecallAI is an AI-powered system designed to automatically extract important events such as meetings, deadlines, reminders, and tasks from different data sources like emails, documents, and uploaded files. The system processes unstructured text, identifies timeline events, converts them into structured data, and stores them for intelligent retrieval.
The goal of RecallAI is to act as a context-aware memory assistant that helps users easily track upcoming activities and retrieve information through natural language queries.
Problem Statement
People receive a large amount of information daily through emails, documents, and messages. Important events such as meetings, deadlines, or reminders are often hidden inside unstructured text and can easily be missed.
Manually tracking these events is time-consuming and inefficient. RecallAI solves this problem by automatically detecting and organizing important timeline information using artificial intelligence.
Key Features
Automatic extraction of meetings, deadlines, and reminders from text
Supports multiple input sources such as email and document uploads
Converts natural language dates like today, tomorrow, or next Monday into structured formats
Stores extracted events in a centralized database
Context-aware AI chat interface to retrieve stored information
Real-time workflow automation for data processing
System Architecture
RecallAI is built using an automated workflow pipeline that processes incoming information step by step.
Data Ingestion
Data is collected from multiple sources:
Email messages
Uploaded PDF documents
Webhook requests from the frontend application
AI Processing
The extracted text is processed by an AI model that identifies timeline events and converts them into structured JSON data.
Event Normalization
Natural language dates are converted into standard date formats to ensure consistency.
Storage
All structured events are stored in a database for efficient retrieval.
Query Pipeline
Users can ask questions through a chat interface, and the system retrieves relevant events using contextual information.
Technology Stack
Workflow Automation: n8n
AI Model: Groq LLM (LLaMA 3.3 70B)
Database: Supabase
Frontend: React / TypeScript
Automation Triggers: Gmail API and Webhooks
Document Processing: PDF text extraction
Workflow Pipeline
Data Ingestion Pipeline
Gmail Trigger receives incoming email
Text content is extracted from email or document
AI model analyzes the text and identifies events
Events are converted into structured JSON format
Natural language dates are normalized
Events are stored in the database
Query Pipeline
User asks a question through the chat interface
The system converts the question into embeddings
Relevant events are retrieved from the database
AI generates a contextual response
The answer is returned to the user interface
Example Input
Example email or document text:
Copy code

Project kickoff meeting tomorrow at 4 PM with the AI team.
Client presentation next Monday at 11:30 AM.
Final prototype submission deadline on January 20.
Extracted Output
The system converts the information into structured event data:
Copy code

[
  {
    "event_type": "meeting",
    "date": "2026-03-11",
    "time": "16:00",
    "description": "Project kickoff meeting",
    "participants": ["AI Team"]
  }
]
Use Cases
Personal productivity assistant
Project management tracking
AI-powered scheduling assistant
Automated meeting tracking
Knowledge management system
Future Enhancements
Integration with Google Calendar
Real-time notification system
Mobile application support
Advanced semantic search for historical events
Multi-user collaboration support
Conclusion
RecallAI demonstrates how artificial intelligence and workflow automation can transform unstructured information into meaningful insights. By automatically extracting and organizing timeline events, the system helps users manage tasks and schedules more efficiently.
