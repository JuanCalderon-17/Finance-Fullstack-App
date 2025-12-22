export interface Transaction {
    id: number;
    description: string;
    amount: number;
    transactionDate: Date;
    category: string;
}