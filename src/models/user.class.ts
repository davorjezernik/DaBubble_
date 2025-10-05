export class User {
  uid: string;
  name: string;
  email: string;

  constructor(obj?: any) {
    this.uid = obj?.uid ?? '';
    this.name = obj?.name ?? '';    
    this.email = obj?.email ?? '';
  }

  public toJSON() {
    return {
      uid: this.uid,
      name: this.name,
      email: this.email
    };
  }
}