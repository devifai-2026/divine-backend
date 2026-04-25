import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const productSchema = new mongoose.Schema({
  name: String,
  purpose: [String],
  rashi: [String],
  isActive: Boolean,
}, { strict: false });

const Product = mongoose.model('Product', productSchema);

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const products = await Product.find({ isActive: true });
    console.log('Total Products:', products.length);
    const withPurpose = products.filter(p => p.purpose && p.purpose.length > 0);
    console.log('Products with Purpose:', withPurpose.length);
    if (withPurpose.length > 0) {
      console.log('Sample Purposes:', withPurpose[0].purpose);
    }
    const withRashi = products.filter(p => p.rashi && p.rashi.length > 0);
    console.log('Products with Rashi:', withRashi.length);
    if (withRashi.length > 0) {
      console.log('Sample Rashis:', withRashi[0].rashi);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
