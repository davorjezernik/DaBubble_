# Firestore DM Structure - Analyse & Löschanleitung

**Datum:** 2. Dezember 2025  
**Zweck:** Analyse der DM-Datenstruktur und sichere Löschanleitung

---

## 1. Firestore Datenstruktur für DMs

### Hauptstruktur

```
firestore/
├── dms/                                    # Collection: Alle DM-Konversationen
│   └── {dmId}/                            # Document: Eine DM-Konversation (z.B. "user1-user2")
│       ├── members: [uid1, uid2]          # Array der Teilnehmer-UIDs
│       ├── createdAt: Timestamp           # Erstellungszeitpunkt
│       ├── lastMessageAt: Timestamp       # Letzte Nachricht
│       └── messages/                      # Subcollection: Nachrichten dieser DM
│           └── {messageId}/               # Document: Eine einzelne Nachricht
│               ├── text: string           # Nachrichtentext
│               ├── authorId: string       # UID des Absenders
│               ├── timestamp: Timestamp   # Sendezeitpunkt
│               ├── authorAvatar: string   # Avatar des Absenders
│               ├── authorName: string     # Name des Absenders
│               ├── reactions: {}          # Reaktionen auf Nachricht
│               ├── edited: boolean        # Wurde bearbeitet
│               ├── sortAt: Timestamp      # Sortierstempel
│               └── thread/                # Subcollection: Thread-Antworten
│                   └── {threadMsgId}/     # Document: Thread-Nachricht
│                       └── [gleiche Felder wie Nachricht]
└── users/
    └── {userId}/
        └── readState/                     # Subcollection: Lesestatus
            └── dms/                       # Subcollection: DM-Lesestatus
                └── {dmId}/                # Document: Lesestatus für eine DM
                    └── lastReadAt: Timestamp

```

### DM-ID Format

Die DM-ID wird aus beiden Benutzer-UIDs generiert (alphabetisch sortiert):

```typescript
// Beispiel aus dm-list.ts (Zeile 208-211)
calculateDmId(otherUser: User): string {
  const uid1 = this.meUid;
  const uid2 = otherUser.uid;
  return uid1 < uid2 ? `${uid1}-${uid2}` : `${uid2}-${uid1}`;
}
```

**Beispiel:**

- User A: `abc123`
- User B: `xyz789`
- DM-ID: `abc123-xyz789`

---

## 2. Code-Stellen die DMs schreiben

### 2.1 DM-Dokument erstellen

**Datei:** `new-message.ts` (Zeile 331-339)

```typescript
await setDoc(dmRef, {
  members: [myUid, otherUid],
  createdAt: serverTimestamp(),
  lastMessageAt: serverTimestamp(),
});
```

### 2.2 Nachricht hinzufügen

**Datei:** `base-chat-interface-component.ts` (Zeile 179-199)

```typescript
const messageData = {
  text: messageText,
  timestamp: serverTimestamp(),
  sortAt: Timestamp.now(),
  authorId: this.currentUserId,
  authorAvatar: this.currentUserAvatar,
  authorName: this.currentUserDisplayName,
};

const messagesCollectionRef = collection(
  this.firestore,
  `${this.collectionName}/${this.chatId}/messages` // collectionName = 'dms'
);
await addDoc(messagesCollectionRef, messageData);
```

### 2.3 Lesestatus aktualisieren

**Datei:** `read-state.service.ts` (Zeile 229)

```typescript
setDoc(ref, { lastReadAt: serverTimestamp() }, { merge: true });
// ref = users/{userId}/readState/dms/{dmId}
```

---

## 3. Sichere Löschmethoden

### ⚠️ WICHTIG: Was NICHT gelöscht werden sollte

- **NICHT löschen:** `users/` Collection (Benutzerprofile)
- **NICHT löschen:** `channels/` Collection (Kanäle)
- **NUR löschen:** DM-Nachrichten und optional DM-Dokumente

---

## 4. Lösch-Strategien

### Strategie A: Nur Nachrichten löschen (Konversationen behalten)

**Was bleibt:** DM-Dokumente mit `members`, `createdAt`, `lastMessageAt`  
**Was wird gelöscht:** Alle Nachrichten in `dms/{dmId}/messages/`

**Vorteil:** Konversationsstruktur bleibt erhalten, neue Nachrichten funktionieren sofort  
**Nachteil:** Leere Konversationen bleiben in der DM-Liste sichtbar

---

### Strategie B: Komplette DMs löschen (inkl. Dokumente)

**Was wird gelöscht:** Komplette `dms/{dmId}` Dokumente + alle Nachrichten  
**Was wird gelöscht:** Lesestatus in `users/{userId}/readState/dms/{dmId}`

**Vorteil:** Komplett sauberer Zustand  
**Nachteil:** DM-Dokumente müssen bei neuer Nachricht neu angelegt werden

---

### Strategie C: Nur eigene Nachrichten löschen

**Was wird gelöscht:** Nur Nachrichten von einem bestimmten `authorId`

**Vorteil:** Selektive Löschung möglich  
**Nachteil:** Konversationen bleiben teilweise bestehen

---

## 5. Firebase CLI Lösch-Befehle

### Voraussetzungen

```bash
# Firebase CLI installieren (falls noch nicht vorhanden)
npm install -g firebase-tools

# Login
firebase login

# Projekt auswählen
firebase use --add
```

### 5.1 Alle DM-Nachrichten löschen (Strategie A)

```bash
# Firestore Extension für Recursive Delete
firebase ext:install delete-user-data
```

**Manuelles Löschen mit Node.js Script:**

```javascript
// delete-dm-messages.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteAllDmMessages() {
  const dmsSnapshot = await db.collection('dms').get();

  for (const dmDoc of dmsSnapshot.docs) {
    const dmId = dmDoc.id;
    console.log(`Deleting messages in DM: ${dmId}`);

    // Alle Nachrichten dieser DM löschen
    const messagesRef = db.collection(`dms/${dmId}/messages`);
    const batch = db.batch();
    const messagesSnapshot = await messagesRef.get();

    messagesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${messagesSnapshot.size} messages from ${dmId}`);
  }

  console.log('All DM messages deleted!');
}

deleteAllDmMessages().catch(console.error);
```

**Ausführen:**

```bash
node delete-dm-messages.js
```

---

### 5.2 Komplette DMs löschen (Strategie B)

```javascript
// delete-all-dms.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(500);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function deleteAllDms() {
  console.log('Fetching all DMs...');
  const dmsSnapshot = await db.collection('dms').get();

  for (const dmDoc of dmsSnapshot.docs) {
    const dmId = dmDoc.id;
    console.log(`Deleting DM: ${dmId}`);

    // 1. Lösche alle Thread-Nachrichten (nested)
    const messagesSnapshot = await db.collection(`dms/${dmId}/messages`).get();
    for (const msgDoc of messagesSnapshot.docs) {
      await deleteCollection(`dms/${dmId}/messages/${msgDoc.id}/thread`);
    }

    // 2. Lösche alle Nachrichten
    await deleteCollection(`dms/${dmId}/messages`);

    // 3. Lösche das DM-Dokument selbst
    await dmDoc.ref.delete();

    console.log(`Deleted DM: ${dmId}`);
  }

  // 4. Lösche Lesestatus aller User
  console.log('Cleaning up read states...');
  const usersSnapshot = await db.collection('users').get();
  for (const userDoc of usersSnapshot.docs) {
    await deleteCollection(`users/${userDoc.id}/readState/dms`);
  }

  console.log('All DMs completely deleted!');
}

deleteAllDms().catch(console.error);
```

---

### 5.3 Nur Nachrichten eines Users löschen (Strategie C)

```javascript
// delete-user-messages.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const TARGET_USER_ID = 'YOUR_USER_ID_HERE'; // ⚠️ Hier User-ID eintragen

async function deleteUserMessages() {
  const dmsSnapshot = await db.collection('dms').get();

  let totalDeleted = 0;

  for (const dmDoc of dmsSnapshot.docs) {
    const dmId = dmDoc.id;
    const messagesRef = db.collection(`dms/${dmId}/messages`);
    const messagesSnapshot = await messagesRef.where('authorId', '==', TARGET_USER_ID).get();

    if (messagesSnapshot.empty) continue;

    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += messagesSnapshot.size;
    console.log(`Deleted ${messagesSnapshot.size} messages from ${dmId}`);
  }

  console.log(`Total deleted: ${totalDeleted} messages`);
}

deleteUserMessages().catch(console.error);
```

---

## 6. Über Firebase Console (Web-Interface)

### Manuelles Löschen

1. **Firebase Console öffnen:** https://console.firebase.google.com
2. **Projekt auswählen**
3. **Firestore Database** → **Data**
4. **Navigation:**
   - `dms/` Collection öffnen
   - Einzelne DM auswählen (z.B. `user1-user2`)
   - `messages/` Subcollection öffnen
5. **Löschen:**
   - 3-Punkte-Menü → "Delete document"
   - ⚠️ **Problem:** Nur einzelne Dokumente, keine Batch-Löschung

**Empfehlung:** Für große Datenmengen → Node.js Script verwenden

---

## 7. Sicherheitshinweise

### ✅ Vor dem Löschen

1. **Backup erstellen:**

   ```bash
   gcloud firestore export gs://YOUR-BUCKET-NAME/backup-$(date +%Y%m%d)
   ```

2. **Testumgebung nutzen:**

   - Erst auf Development/Staging Firestore testen
   - Nicht direkt auf Production

3. **Service Account Key sicher aufbewahren:**
   - Datei `serviceAccountKey.json` NICHT in Git committen
   - In `.gitignore` eintragen

### ⚠️ Firestore Limits beachten

- **Batch Writes:** Max 500 Operationen pro Batch
- **Transaction:** Max 500 Dokumente
- **Recursive Delete:** Nutze Batches für große Collections

---

## 8. Nach dem Löschen

### Struktur bleibt funktionsfähig

Nach Strategie A (Nachrichten löschen):

- ✅ DM-Dokumente bleiben → neue Nachrichten funktionieren
- ✅ Keine Code-Änderungen nötig
- ⚠️ `lastMessageAt` zeigt altes Datum → Optional zurücksetzen

Nach Strategie B (Komplett löschen):

- ✅ Komplett sauber
- ✅ Neue DMs werden automatisch angelegt
- ⚠️ DM-Liste ist leer bis neue Nachricht gesendet wird

---

## 9. Zusammenfassung

| Strategie              | Löscht                  | Bewahrt               | Code-Anpassung | Empfehlung                   |
| ---------------------- | ----------------------- | --------------------- | -------------- | ---------------------------- |
| **A: Nur Nachrichten** | `dms/{dmId}/messages/*` | `dms/{dmId}` Dokument | Nicht nötig    | ✅ Empfohlen für Entwicklung |
| **B: Komplett**        | `dms/{dmId}` + alles    | Nichts                | Nicht nötig    | ✅ Empfohlen für Clean State |
| **C: User-spezifisch** | Nachrichten von 1 User  | Rest                  | Nicht nötig    | ⚠️ Nur für spezielle Fälle   |

---

## 10. Service Account Key erstellen

1. **Firebase Console** → **Project Settings** → **Service Accounts**
2. **Generate new private key** klicken
3. Datei `serviceAccountKey.json` herunterladen
4. In Projektordner legen (außerhalb von `src/`)
5. In `.gitignore` eintragen:
   ```
   serviceAccountKey.json
   ```

---

**⚠️ WICHTIG:** Ich kann als KI **NICHT direkt auf Firebase zugreifen**. Du musst die Scripte lokal ausführen mit deinem Service Account Key.
