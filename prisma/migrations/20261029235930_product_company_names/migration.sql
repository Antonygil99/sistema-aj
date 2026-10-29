DROP INDEX "Product_name_key";
CREATE UNIQUE INDEX "Product_insurerId_line_name_key" ON "Product"("insurerId","line","name");
