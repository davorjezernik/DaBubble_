export class User {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  online: boolean;
  recentEmojis: string[];

  constructor(obj?: any) {
    this.uid = obj?.uid ?? '';
    this.name = obj?.name ?? '';    
    this.email = obj?.email ?? '';
    this.avatar = obj?.avatar ?? '';
    this.online = obj?.online ?? false;
    this.recentEmojis = obj?.recentEmojis ?? [];
  }

  public toJSON() {
    return {
      uid: this.uid,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      online: this.online,
      recentEmojis: this.recentEmojis,
    };
  }
}