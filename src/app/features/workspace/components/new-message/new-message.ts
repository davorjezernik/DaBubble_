import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageAreaComponent } from '../../../../shared/components/message-area-component/message-area-component';
import {
  MentionListComponent,
  MentionUser,
  MentionChannel,
} from '../../../../shared/components/mention-list.component/mention-list.component';
import { UserService } from '../../../../../services/user.service';
import { AuthService } from '../../../../../services/auth-service';
import { ChannelService } from '../../../../../services/channel-service';
import { Router } from '@angular/router';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
} from '@angular/fire/firestore';
import { firstValueFrom, filter, take } from 'rxjs';
import { User } from '@angular/fire/auth';

type Target = { kind: 'dm' | 'channel'; id: string; label: string };

@Component({
  selector: 'app-new-message',
  standalone: true,
  templateUrl: './new-message.html',
  styleUrls: ['./new-message.scss'],
  imports: [CommonModule, FormsModule, MessageAreaComponent, MentionListComponent],
})
export class NewMessageComponent implements OnInit {
  recipientText = ''; // aktueller Text im Input
  showMention = false; // Mention-Popover sichtbar?
  mentionMode: 'users' | 'channels' = 'users'; // gerade @ oder #?
  mentionSearch = ''; // Filter für MentionList
  mentionUsers: MentionUser[] = []; // alle Nutzer (für MentionList)
  mentionChannels: MentionChannel[] = []; // alle Channels (für MentionList)
  recipientFocused = false; // hat das Input Focus?
  openOnFreeText = true; // Freitext-Öffnung für User
  minTokenLen = 2; // ab wieviel Buchstaben öffnen
  pendingPrefix: '@' | '#' | null = null; // gemerkter Prefix zum Zurücknehmen

  // Mehrfach-Auswahl: hier landen alle ausgewählten Ziele
  selectedTargets: Target[] = [];

  // Services
  private userService = inject(UserService);
  private channelService = inject(ChannelService);

  constructor(private router: Router, private firestore: Firestore, private auth: AuthService) {}

  // -----------------------------------------------
  // ngOnInit: lädt Users & Channels für MentionList
  // -----------------------------------------------
  async ngOnInit() {
  // 1) Users für @
  const users = await firstValueFrom(this.userService.users$());
  this.mentionUsers = users.map(u => ({
    uid: u.uid,
    name: u.name,
    avatar: u.avatar,
    online: u.online,
    email: u.email || '',
  }));

  // 2) aktueller User (wartet bis uid wirklich da ist)
  const me = await firstValueFrom(
  this.auth.currentUser$.pipe(
    filter((u): u is User => u != null), // ← korrektes Predicate
    take(1)
  )
);
const myUid = me.uid;

  // 3) Channels laden
  const allChannels = await firstValueFrom(this.channelService.getChannels());

  // 4) nur Channels, in denen ich Mitglied bin (string[] oder {uid}[])
  const myChannels = (allChannels ?? []).filter((c: any) => {
    const raw = c?.members ?? c?.memberIds ?? [];
    if (!Array.isArray(raw)) return false;
    return raw.some((m: any) => {
      if (typeof m === 'string') return m === myUid;
      const uid = m?.uid ?? m?.userId ?? m?.user?.uid ?? null;
      return uid === myUid;
    });
  });

  // 5) auf MentionChannel mappen
  this.mentionChannels = myChannels.map((c: any) => ({
    id: c.id,
    name: c.name,
  }));
}
  // ---------------------------------------------------------
  // onRecipientKeyDown: @/# öffnen; Enter -> Versuch zu parsen
  // ---------------------------------------------------------
  onRecipientKeyDown(e: KeyboardEvent) {
    if (e.key === '@' || e.key === '#') {
      this.mentionMode = e.key === '@' ? 'users' : 'channels';
      this.showMention = true;
      this.pendingPrefix = e.key as '@' | '#';
      return;
    }

    // Enter im Input: versuche den aktuellen Text in ein Ziel umzuwandeln
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = this.resolveTargetFromRecipient();
      if (t) {
        // 👉 auf Target mit id mappen
        if (t.kind === 'dm') {
          this.addTargetIfNotExists({ kind: 'dm', id: t.userUid, label: t.label });
        } else {
          this.addTargetIfNotExists({ kind: 'channel', id: t.channelId, label: t.label });
        }
        this.recipientText = '';
        this.showMention = false;
        this.pendingPrefix = null;
      }
      return;
    }

    // ESC schließt die Mention-Liste
    if (e.key === 'Escape' && this.showMention) {
      this.showMention = false;
      this.revertPendingPrefixIfAny();
      return;
    }
  }

  // ---------------------------------------------------------------------
  // onRecipientInput: steuert Öffnen/Schließen + Filter der Mention-Liste
  // ---------------------------------------------------------------------
  onRecipientInput() {
    const val = this.recipientText || '';
    const trimmed = val.trimEnd();

    // 1) klassisches @ / #-Token am Ende
    const mentionMatch = /(^|\s)([@#])([^\s@#]*)$/i.exec(trimmed);
    if (this.recipientFocused && mentionMatch) {
      this.mentionMode = mentionMatch[2] === '@' ? 'users' : 'channels';
      this.mentionSearch = mentionMatch[3];
      this.showMention = true;
      this.pendingPrefix =
        this.mentionSearch.length === 0 ? (this.mentionMode === 'users' ? '@' : '#') : null;
      return;
    }

    // 2) E-Mail im letzten Token
    const token = this.getLastToken(trimmed);
    if (this.recipientFocused && this.isLikelyEmail(token)) {
      this.mentionMode = 'users';
      this.mentionSearch = token;
      this.showMention = true;
      this.pendingPrefix = null;
      return;
    }

    // 3) Freitext (z. B. "ch") => optional öffnen & filtern nach Name/E-Mail
    if (
      this.recipientFocused &&
      this.openOnFreeText &&
      token.length >= this.minTokenLen &&
      !token.startsWith('#')
    ) {
      this.mentionMode = 'users';
      this.mentionSearch = token;
      this.showMention = true;
      this.pendingPrefix = null;
      return;
    }

    // sonst: Liste schließen
    this.showMention = false;
    this.mentionSearch = '';
    this.pendingPrefix = null;
  }

  // ----------------------------------------
  // getLastToken: letztes Wort aus dem String
  // ----------------------------------------
  private getLastToken(s: string): string {
    const parts = s.split(/\s+/);
    return parts[parts.length - 1] || '';
  }

  // ---------------------------------------------
  // isLikelyEmail: einfache E-Mail-Erkennung (Regex)
  // ---------------------------------------------
  private isLikelyEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
  }

  // ---------------------------------------------------------
  // onRecipientBlur: blur schließt Liste + löscht @/# wenn leer
  // ---------------------------------------------------------
  onRecipientBlur() {
    setTimeout(() => {
      this.recipientFocused = false;
      this.showMention = false;
      this.revertPendingPrefixIfAny();
    }, 120);
  }

  // ------------------------------------------------------------------
  // onDocClick: Click außerhalb schließt Liste + löscht leeres Präfix
  // ------------------------------------------------------------------
  @HostListener('document:click', ['$event'])
  onDocClick(_ev: MouseEvent) {
    if (!this.recipientFocused && this.showMention) {
      this.showMention = false;
    }
    if (!this.recipientFocused) {
      this.revertPendingPrefixIfAny();
    }
  }

  // -----------------------------------------------------------------------
  // insertMention: ersetzt das aktuelle Token durch den eingeklickten Wert
  // (bei Multi-Select nutzen wir die spezialisierten Picker-Handler unten)
  // -----------------------------------------------------------------------
  insertMention(insertValue: string) {
    const cur = this.recipientText || '';
    this.recipientText = cur.replace(
      /(^|\s)(?:[@#][^\s@#]*|[^\s@]+@[^\s@]+\.[^\s@]+|[^\s]+)$/i,
      (_m, g1) => `${g1}${insertValue}`
    );
    this.showMention = false;
    this.pendingPrefix = null;
  }

  // -------------------------------------------------------------------------
  // revertPendingPrefixIfAny: entfernt ein automatisch gesetztes @/# wieder
  // -------------------------------------------------------------------------
  private revertPendingPrefixIfAny() {
    if (!this.pendingPrefix) return;

    const s = (this.recipientText || '').trimEnd();
    const lastToken = this.getLastToken(s);

    if (lastToken === this.pendingPrefix) {
      this.recipientText = s.replace(/(\s)?[@#]$/i, '').trimEnd();
    }

    this.pendingPrefix = null;
  }

  // ---------------------------------------------------------------------
  // onMentionUserPicked: User aus der Liste in die Auswahl übernehmen
  // ---------------------------------------------------------------------
  onMentionUserPicked(u: MentionUser) {
    this.addTargetIfNotExists({ kind: 'dm', id: u.uid, label: `@${u.name}` });
    this.recipientText = '';
    this.showMention = false;
    this.pendingPrefix = null;
  }

  // ------------------------------------------------------------------------
  // onMentionChannelPicked: Channel aus der Liste in die Auswahl übernehmen
  // ------------------------------------------------------------------------
  onMentionChannelPicked(c: MentionChannel) {
    this.addTargetIfNotExists({ kind: 'channel', id: c.id, label: `#${c.name}` });
    this.recipientText = '';
    this.showMention = false;
    this.pendingPrefix = null;
  }

  // ---------------------------------------------------------------------------
  // addTargetIfNotExists: vermeidet Duplikate (ein User/Channel nur 1x wählen)
  // ---------------------------------------------------------------------------
  private addTargetIfNotExists(t: Target) {
    const exists = this.selectedTargets.some((x) => x.kind === t.kind && x.id === t.id);
    if (!exists) this.selectedTargets.push(t);
  }

  // ----------------------------------------------------------
  // removeTarget: Entfernt einen Chip aus der Auswahl (X-Button)
  // ----------------------------------------------------------
  removeTarget(t: Target) {
    this.selectedTargets = this.selectedTargets.filter(
      (x) => !(x.kind === t.kind && x.id === t.id)
    );
  }

  // -----------------------------------------------------------------------------------
  // handleSendFromFooter: sendet die Nachricht an ALLE ausgewählten Ziele (DMs/Channels)
  // - bei exakt 1 Ziel: navigiert anschließend in diesen Chat/Channel
  // - bei mehreren Zielen: sendet an alle, bleibt auf der Seite (oder passe an)
  // -----------------------------------------------------------------------------------
  async handleSendFromFooter(text: string) {
    const clean = text?.trim();
    if (!clean || this.selectedTargets.length === 0) return;

    // an alle Ziele senden
    for (const t of this.selectedTargets) {
      if (t.kind === 'dm') {
        await this.sendToDm(t.id, clean);
      } else {
        await this.sendToChannel(t.id, clean);
      }
    }

    // wenn genau ein Ziel ausgewählt ist -> in diesen Chat/Channel wechseln
    if (this.selectedTargets.length === 1) {
      const only = this.selectedTargets[0];
      if (only.kind === 'dm') {
        const myUid = await this.getMyUid();
        const dmId = this.buildDmId(myUid, only.id);
        this.router.navigate(['/workspace', 'dm', dmId]);
      } else {
        this.router.navigate(['/workspace', 'channel', only.id]);
      }
    }

    // Eingabebox der MessageArea leert sich selbst (vom Kind-Component),
    // hier lassen wir die Empfängerchips stehen – oder du räumst auf:
    // this.selectedTargets = [];
  }

  // ------------------------------------------------------------------
  // resolveTargetFromRecipient:
  // versucht aus dem freien Text EIN Ziel zu erkennen (Name/E-Mail/Channel)
  // -> hilfreich für Enter im Input
  // ------------------------------------------------------------------
  private resolveTargetFromRecipient():
    | { kind: 'dm'; userUid: string; label: string }
    | { kind: 'channel'; channelId: string; label: string }
    | null {
    const raw = (this.recipientText || '').trim();
    if (!raw) return null;

    // 1) Channel via #Name
    const ch = this.mentionChannels.find(
      (c) =>
        raw.toLowerCase().includes(`#${c.name.toLowerCase()}`) ||
        raw.toLowerCase() === c.name.toLowerCase()
    );
    if (ch) {
      return { kind: 'channel', channelId: ch.id, label: `#${ch.name}` };
    }

    // 2) User via "@<voller Name>" (erlaubt Leerzeichen)
    const uByAtFull = this.mentionUsers.find((u) =>
      raw.toLowerCase().includes(`@${u.name.toLowerCase()}`)
    );
    if (uByAtFull) {
      return { kind: 'dm', userUid: uByAtFull.uid, label: `@${uByAtFull.name}` };
    }

    // 3) E-Mail irgendwo
    const mailMatch = raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (mailMatch) {
      const mail = mailMatch[0].toLowerCase();
      const uByMail = this.mentionUsers.find((u) => (u.email || '').toLowerCase() === mail);
      if (uByMail) {
        return { kind: 'dm', userUid: uByMail.uid, label: `@${uByMail.name}` };
      }
    }

    // 4) Fallback: @token (ohne Leerzeichen) -> prefix-match auf Namen
    const at = raw.match(/@([^\s]+)/);
    if (at) {
      const token = at[1].toLowerCase();
      const uByToken = this.mentionUsers.find((u) => u.name.toLowerCase().startsWith(token));
      if (uByToken) {
        return { kind: 'dm', userUid: uByToken.uid, label: `@${uByToken.name}` };
      }
    }

    // 5) Exakter Name ohne @
    const uExact = this.mentionUsers.find((u) => u.name.toLowerCase() === raw.toLowerCase());
    if (uExact) {
      return { kind: 'dm', userUid: uExact.uid, label: `@${uExact.name}` };
    }

    return null;
  }

  // -----------------------------------------
  // getMyUid: aktuelle User-ID aus dem AuthService
  // -----------------------------------------
  private async getMyUid(): Promise<string> {
    const me = await firstValueFrom(this.auth.currentUser$);
    return me?.uid || '';
  }

  // -----------------------------------------------
  // buildDmId: stabile DM-ID (lexikografisch sortiert)
  // -----------------------------------------------
  private buildDmId(a: string, b: string) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  // -----------------------------------------------------------
  // sendToDm: legt DM an (falls nötig) + schreibt eine Nachricht
  // -----------------------------------------------------------
  private async sendToDm(otherUid: string, text: string) {
    const myUid = await this.getMyUid();
    if (!myUid || !otherUid) return;

    const dmId = this.buildDmId(myUid, otherUid);
    const dmRef = doc(this.firestore, `dms/${dmId}`);
    const dmSnap = await getDoc(dmRef);

    if (!dmSnap.exists()) {
      await setDoc(dmRef, {
        members: [myUid, otherUid],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      });
    } else {
      await setDoc(dmRef, { lastMessageAt: serverTimestamp() }, { merge: true });
    }

    await addDoc(collection(this.firestore, `dms/${dmId}/messages`), {
      text,
      authorId: myUid,
      timestamp: serverTimestamp(),
    });
  }

  // ---------------------------------------------------------------
  // sendToChannel: schreibt eine Nachricht in den Channel-Thread
  // ---------------------------------------------------------------
  private async sendToChannel(channelId: string, text: string) {
    const myUid = await this.getMyUid();
    if (!myUid || !channelId) return;

    await addDoc(collection(this.firestore, `channels/${channelId}/messages`), {
      text,
      authorId: myUid,
      timestamp: serverTimestamp(),
    });
  }
}
