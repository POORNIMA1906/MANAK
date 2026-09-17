# Offline SQLite Vector Retrieval — Mobile Implementation Specification

## 1. Objective

Implement a fully offline semantic retrieval layer inside the existing mobile application.

The mobile application must be able to:

1. Receive text from OCR or user input.
2. Generate an embedding for the new query locally on the device.
3. Search a prebuilt SQLite knowledge database containing already-embedded chunks.
4. Return the most relevant chunks.
5. Pass the retrieved information to the existing deterministic rule engine.
6. Continue working with the device in airplane mode / without internet.

The mobile application must **not** perform document ingestion, chunking, or knowledge-base embedding at runtime.

---

# 2. Core Architecture

## 2.1 Build-time / preprocessing pipeline

The expensive knowledge-base processing happens before the mobile application is distributed.

```text
Source Documents
      |
      v
Document Cleaning
      |
      v
Chunking
      |
      v
Embedding Model
      |
      v
Precomputed Embeddings
      |
      v
SQLite Knowledge Database
      |
      v
Bundle with Mobile Application
```

The resulting SQLite database is a static knowledge asset.

Example:

```text
knowledge.db
```

The database contains:

- Chunk text
- Chunk IDs
- Precomputed embedding vectors
- Source information
- Rule IDs
- Categories
- Other metadata required by retrieval/rule checking

---

# 3. Mobile Runtime Architecture

```text
+------------------------------------------------------+
|                  MOBILE APPLICATION                  |
|                                                      |
|  OCR / User Input                                    |
|          |                                           |
|          v                                           |
|  Extracted Query / Structured Data                   |
|          |                                           |
|          v                                           |
|  On-device Embedding Model                           |
|          |                                           |
|          v                                           |
|  Query Vector                                        |
|          |                                           |
|          v                                           |
|  Local SQLite Knowledge DB                           |
|          |                                           |
|          v                                           |
|  Vector Similarity Search                            |
|          |                                           |
|          v                                           |
|  Top-K Relevant Chunks                               |
|          |                                           |
|          +-------------------+                       |
|                              |                       |
|                              v                       |
|                       Deterministic                 |
|                       Rule Engine                   |
|                              |                       |
|                              v                       |
|                       Final Result                  |
|                                                      |
+------------------------------------------------------+

                    NO INTERNET
                    NO LLM API
                    NO CLOUD VECTOR DB
```

---

# 4. What Runs Where

| Component | Build Time | Mobile Runtime |
|---|---:|---:|
| Document ingestion | Yes | No |
| Document cleaning | Yes | No |
| Chunking | Yes | No |
| Knowledge-base embeddings | Yes | No |
| SQLite database generation | Yes | No |
| Query embedding | No | Yes |
| Vector similarity search | No | Yes |
| OCR | No | Yes |
| Rule checking | No | Yes |
| LLM | Not required | Not required |
| Internet | Not required | Not required |

The key optimization is:

> **Precompute everything that depends only on the static knowledge base.**

At runtime, only the new query needs to be embedded.

---

# 5. SQLite Database Structure

A recommended logical schema is:

```sql
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    source TEXT,
    category TEXT,
    rule_id TEXT,
    metadata TEXT
);

CREATE TABLE embeddings (
    chunk_id INTEGER PRIMARY KEY,
    embedding BLOB NOT NULL,
    FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);
```

The exact schema may change depending on the SQLite vector-search implementation selected for the mobile framework.

If a native SQLite vector extension is available, use it.

If not, store vectors in a compact binary representation and perform similarity calculation in the application/native retrieval layer.

Do not introduce ChromaDB merely to avoid implementing local retrieval.

---

# 6. Embedding Storage

Each knowledge chunk has one precomputed embedding.

Example:

```text
Chunk:
"Cold-chain medicines must remain between 2°C and 8°C."

Embedding:
[0.124, -0.321, 0.811, ...]
```

The embedding is generated during preprocessing and stored in the database.

The mobile application must NOT regenerate these vectors.

---

# 7. Runtime Query Embedding

A local embedding model is still required if semantic vector retrieval is used.

Example:

```text
OCR:
"Medicine was stored at 9 degrees Celsius."

        |
        v

On-device embedding model

        |
        v

Query vector:
[0.131, -0.307, 0.798, ...]
```

That vector is compared against the precomputed vectors in SQLite.

The embedding model must be packaged with the application.

Possible implementation technologies depend on the mobile framework, for example:

- ONNX Runtime Mobile
- TensorFlow Lite
- Core ML on supported Apple devices
- Other framework-compatible local inference runtimes

Do not choose the runtime blindly. First inspect the existing mobile framework and target Android/iOS requirements.

---

# 8. Critical Embedding Compatibility Rule

The model used during preprocessing and the model used at runtime must be compatible.

Record these values as part of the knowledge-base build configuration:

```text
Embedding model:
Embedding dimension:
Similarity metric:
Normalization:
Model version:
Chunking strategy:
```

For example:

```text
Embedding model: <MODEL_NAME>
Dimension: <DIMENSION>
Metric: cosine
Normalization: L2-normalized
```

Do not generate the database with one embedding model and query it with an unrelated model.

Otherwise, vector similarity will not be meaningful.

---

# 9. Retrieval Process

The retrieval API should conceptually look like:

```text
retrieve(query, topK)
```

Example:

```text
retrieve(
    "Was the medicine stored at the required temperature?",
    5
)
```

Process:

```text
1. Receive query
       |
       v
2. Generate query embedding locally
       |
       v
3. Search SQLite vectors
       |
       v
4. Calculate similarity
       |
       v
5. Sort by similarity
       |
       v
6. Return Top-K chunks
```

Example output:

```json
[
  {
    "chunkId": 17,
    "text": "Cold-chain products must be maintained between 2°C and 8°C.",
    "score": 0.94,
    "ruleId": "CC_TEMP_001"
  },
  {
    "chunkId": 21,
    "text": "Temperature excursions above 8°C must be recorded.",
    "score": 0.89,
    "ruleId": "CC_TEMP_004"
  }
]
```

---

# 10. Similarity Search

If cosine similarity is selected:

```text
similarity(A, B) =
        A · B
---------------------
      ||A|| ||B||
```

If all vectors are L2-normalized beforehand, cosine similarity can be simplified to a dot product:

```text
similarity = A · B
```

Use exactly the same normalization convention during preprocessing and runtime.

---

# 11. Top-K Retrieval

Do not retrieve only one chunk by default.

Prefer:

```text
Top-K = 3 to 10
```

depending on the knowledge-base size and application requirements.

Example:

```text
Query
  |
  v
Top 5 chunks
  |
  +--> Rule 1
  +--> Rule 2
  +--> Rule 3
  +--> Rule 4
  +--> Rule 5
```

The rule engine can then determine which rule actually applies.

A high vector similarity score does **not** mean the retrieved chunk is automatically the legally/correctly applicable rule.

---

# 12. Hybrid Retrieval

For a rule-heavy application, pure semantic retrieval should not be the only mechanism.

A stronger design is:

```text
                 Query
                   |
          +--------+--------+
          |                 |
          v                 v
    Vector Search       Exact/Keyword
          |                 |
          +--------+--------+
                   |
                   v
          Candidate Chunks
                   |
                   v
          Metadata Filtering
                   |
                   v
          Rule Applicability
                   |
                   v
             Final Result
```

Useful metadata filters include:

- Category
- Document type
- Rule ID
- Jurisdiction/version
- Product type
- Date/version
- Language
- Section

This reduces false semantic matches.

---

# 13. Rule Engine Separation

The retrieval system must NOT make the final decision.

Use this separation:

```text
Retrieval:
"What information/rules are relevant?"

Rule Engine:
"Does the extracted data satisfy the applicable rule?"
```

Example:

```text
OCR extracted:

temperature = 9°C
required_max_temperature = 8°C
```

The rule engine can deterministically evaluate:

```text
9 <= 8
```

Result:

```text
FAIL
```

The vector retrieval system can provide the supporting rule:

```text
"Cold-chain products must remain between 2°C and 8°C."
```

This separation is important for reliability, debugging and auditability.

---

# 14. Database Packaging

The prebuilt database should be included as an application asset.

Example project structure:

```text
mobile-app/
|
+-- assets/
|   |
|   +-- database/
|       |
|       +-- knowledge.db
|
+-- models/
|   |
|   +-- embedding-model/
|
+-- src/
    |
    +-- database/
    |   +-- DatabaseManager
    |
    +-- retrieval/
    |   +-- EmbeddingService
    |   +-- VectorSearchService
    |   +-- RetrievalService
    |
    +-- rules/
    |   +-- RuleEngine
    |
    +-- ocr/
        +-- OCRService
```

The exact directories depend on the existing application framework.

---

# 15. Database Initialization

On first launch:

```text
Application starts
       |
       v
Check whether knowledge.db exists
       |
       +---- YES ---> Open existing DB
       |
       +---- NO ----> Copy bundled DB
                       |
                       v
                 Open local DB
```

The bundled database should be treated as read-only knowledge data unless the application specifically requires updates.

Do not download the database from a server.

---

# 16. Offline Guarantee

The retrieval path must have zero network dependencies.

Test with:

```text
Wi-Fi OFF
Mobile Data OFF
Airplane Mode ON
```

Then verify:

```text
OCR
  ↓
Query
  ↓
Local embedding model
  ↓
SQLite
  ↓
Vector retrieval
  ↓
Rule engine
  ↓
Result
```

continues to work.

No HTTP request should occur anywhere in this path.

---

# 17. Updating the Knowledge Base

Because the database is prebuilt, updates should happen by replacing/upgrading the knowledge database.

Recommended process:

```text
New documents
     ↓
Offline/Developer preprocessing
     ↓
Chunking
     ↓
Embedding
     ↓
Validation
     ↓
New knowledge.db
     ↓
New application release
```

If future requirements need downloadable rule updates, that can be added as a separate feature. It should not be part of the core offline retrieval implementation.

---

# 18. Versioning

Store a knowledge-base version.

Example:

```text
database_metadata

version = "2026.09"
embedding_model = "<MODEL>"
embedding_dimension = 768
similarity_metric = "cosine"
```

This allows the application to know exactly which knowledge set it is using.

If rules change, rebuild the database rather than modifying individual embeddings manually.

---

# 19. Performance Considerations

Mobile memory and storage are limited.

Before selecting the retrieval implementation, measure:

- Number of chunks
- Embedding dimension
- SQLite database size
- Embedding model size
- RAM usage
- Query latency
- Startup time
- Battery impact

For a relatively small knowledge base, a straightforward vector scan may be sufficient:

```text
Query vector
     ↓
Compare against all vectors
     ↓
Keep highest K
```

For a larger knowledge base, use an appropriate vector index/SQLite vector extension.

Do not introduce ANN indexing solely for theoretical performance if a simple local search is already fast enough on the target device.

---

# 20. Storage Estimate

For a rough estimate:

```text
Vector storage ≈ number_of_chunks × embedding_dimension × bytes_per_value
```

For float32:

```text
bytes_per_value = 4
```

Example:

```text
10,000 chunks
× 768 dimensions
× 4 bytes
≈ 30.7 MB
```

Additional SQLite metadata, text and indexes will increase the total size.

Quantized embeddings can reduce storage requirements, but only introduce quantization after testing retrieval quality.

---

# 21. Error Handling

The retrieval layer must handle:

### Missing database

```text
Knowledge database unavailable
```

Do not silently switch to an online API.

### Missing embedding model

```text
Local embedding model unavailable
```

Report an offline retrieval error.

### Corrupted database

Validate the database before use.

### Query embedding failure

Return a clear retrieval failure rather than producing a fabricated result.

### No sufficiently relevant result

Allow:

```text
No relevant rule found
```

rather than forcing the nearest chunk to be treated as applicable.

---

# 22. Retrieval Confidence

Similarity scores should be treated as retrieval signals, not truth values.

For example:

```text
score = 0.94
```

means the chunk is highly similar according to the selected embedding model and metric.

It does NOT prove:

```text
"The rule definitely applies."
```

Use rule matching, metadata and deterministic validation for that.

A configurable minimum similarity threshold can be introduced after evaluation:

```text
if score < THRESHOLD:
    return "No sufficiently relevant result"
```

The threshold must be determined through testing on representative data, not guessed.

---

# 23. Testing Strategy

Create a fixed retrieval evaluation set.

Example:

```text
test_cases/
|
+-- query_001
|   expected_rule = CC_TEMP_001
|
+-- query_002
|   expected_rule = EXPIRY_003
|
+-- query_003
|   expected_rule = BATCH_004
```

Measure:

- Top-1 retrieval accuracy
- Top-3 retrieval accuracy
- Top-5 retrieval accuracy
- False positive rate
- No-result rate
- Query latency
- Database loading time

Also test difficult cases:

- OCR spelling errors
- Different wording
- Abbreviations
- Numbers
- Units
- Similar rules
- Conflicting-looking chunks
- Missing fields
- Unsupported queries

---

# 24. Security and Privacy

Because retrieval is local:

```text
User/OCR data
      ↓
Local embedding model
      ↓
Local SQLite
```

Sensitive OCR text does not need to leave the device.

Avoid logging complete OCR queries or retrieved documents unless required for debugging.

If logs are necessary, minimize and sanitize them.

---

# 25. Recommended Module Responsibilities

## DatabaseManager

Responsible for:

- Opening SQLite
- Initializing/copying the bundled database
- Database version checks
- Closing connections
- Database integrity checks

## EmbeddingService

Responsible for:

- Loading the local embedding model
- Converting query text → embedding
- Correct preprocessing/tokenization
- Correct normalization
- Reusing the model rather than reloading it for every query

## VectorSearchService

Responsible for:

- Querying SQLite
- Vector similarity
- Top-K selection
- Metadata filtering

## RetrievalService

Responsible for coordinating:

```text
query
 → embedding
 → vector search
 → filtering
 → ranked chunks
```

## RuleEngine

Responsible for:

- Deterministic validation
- Thresholds
- Date/range checks
- Field validation
- Rule applicability
- Final pass/fail/unknown status

Do not mix these responsibilities into one large service.

---

# 26. End-to-End Example

Suppose OCR extracts:

```text
Product: Medicine X
Batch: AB123
Temperature: 9°C
```

The application creates a query:

```text
"temperature storage requirement for Medicine X"
```

The local embedding model produces:

```text
query_vector
```

SQLite retrieval returns:

```text
Chunk A
"Cold-chain products must be maintained between 2°C and 8°C."

Chunk B
"Temperature excursions must be recorded when storage exceeds
the permitted range."

Chunk C
"Products must have a valid batch number."
```

The rule engine uses the structured OCR data:

```text
temperature = 9°C
maximum_allowed = 8°C
```

and determines:

```text
temperature > maximum_allowed
```

The retrieval layer supplied relevant knowledge.

The rule engine supplied the deterministic decision.

No LLM is necessary.

---

# 27. What NOT to Implement

Do not implement:

```text
Mobile
  ↓
API server
  ↓
ChromaDB
  ↓
Embedding API
  ↓
LLM
```

That would defeat the offline requirement.

Do not implement:

```text
Mobile
  ↓
Download documents
  ↓
Chunk documents
  ↓
Embed all documents
  ↓
Build database
```

That wastes mobile CPU, storage and battery and is unnecessary for a fixed knowledge base.

The preferred architecture is:

```text
PRECOMPUTE ONCE
     ↓
PACKAGE
     ↓
QUERY LOCALLY
     ↓
RETRIEVE LOCALLY
     ↓
VALIDATE LOCALLY
```

---

# 28. Final Target Architecture

```text
                    PREPROCESSING MACHINE
                    =====================

 Documents
     |
     v
 Cleaning
     |
     v
 Chunking
     |
     v
 Embedding Model
     |
     v
 Precomputed Vectors
     |
     v
 knowledge.db
     |
     +----------------------------+
                                  |
                                  v
                         MOBILE APPLICATION


                    MOBILE DEVICE
                    =============

       Camera / User Input
               |
               v
          Offline OCR
               |
               v
          Query Builder
               |
               v
     +-----------------------+
     | On-device Embedding   |
     | Model                 |
     +-----------------------+
               |
               v
         Query Vector
               |
               v
     +-----------------------+
     | Local SQLite          |
     | knowledge.db          |
     +-----------------------+
               |
               v
       Vector Similarity
               |
               v
            Top-K
          Chunks
               |
               v
      Metadata Filtering
               |
               v
        Deterministic
         Rule Engine
               |
               v
        Final Result
```

## Final Principle

The system should follow one strict rule:

> **The knowledge base is embedded once before deployment. The mobile device only embeds the incoming query and searches the already-embedded local SQLite database.**

This provides semantic retrieval without an internet connection, without a cloud vector database, without ChromaDB, without a runtime ingestion pipeline, and without requiring an LLM.
