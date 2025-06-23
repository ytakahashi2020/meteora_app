# Meteora DLMM Liquidity Provider

A sophisticated decentralized liquidity provider interface for Meteora's Dynamic Liquidity Market Making (DLMM) protocol on Solana.

## 🌟 Features

### 💰 Liquidity Management
- **SOL-USDC Pool**: Specialized interface for the SOL-USDC trading pair
- **Auto-calculation**: Smart USDC amount calculation based on SOL input
- **Balance Validation**: Real-time balance checking with insufficient funds prevention
- **Position Management**: View and manage all your liquidity positions

### 🎨 Modern UI/UX
- **Dark Theme**: Sophisticated gradient design with glass morphism effects
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Toast Notifications**: Beautiful success/error notifications with transaction links
- **Loading States**: Smooth animations and loading indicators

### 🔐 Wallet Integration
- **Multi-wallet Support**: Phantom, Solflare wallet compatibility
- **Secure Transactions**: Transaction signing and confirmation
- **Connection Status**: Real-time wallet connection indicators

### ⚡ Advanced Features
- **Transaction Tracking**: Direct links to Solscan explorer
- **One-click Copy**: Copy transaction hashes to clipboard
- **Error Handling**: Comprehensive error messages and recovery suggestions
- **Fee Display**: Clear breakdown of earned fees and position details

## 🚀 Technology Stack

- **Frontend**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with custom animations
- **Blockchain**: Solana Web3.js
- **Wallet**: Solana Wallet Adapter
- **Protocol**: Meteora DLMM SDK
- **Deployment**: Vercel

## 📁 Project Structure

```
meteora-ui/          # Next.js application
├── src/
│   ├── app/         # App Router pages
│   └── components/  # React components
index*.js            # Original script files
```

## 🛠 Installation

1. Clone the repository:
```bash
git clone https://github.com/ytakahashi2020/meteora_app.git
cd meteora_app/meteora-ui
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Configuration

The application uses Helius RPC endpoint for Solana connectivity. For production, consider using your own RPC endpoint.

## 🌐 Live Demo

Visit the live application: [Meteora DLMM App](https://your-vercel-deployment-url.vercel.app)

## 📜 License

This project is for educational and demonstration purposes.

---

Built with ❤️ using Meteora DLMM Protocol