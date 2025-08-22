import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ScrollView, Modal } from "react-native";
import { Ionicons } from '@expo/vector-icons';

// Mock executiveId to name (you could fetch this from your real data)
const executiveNames = {
  1: "Alice",
  2: "Bob",
  3: "Charlie",
  0: "Test Exec"
};

// Mock data
const mockApprovalItems = [
  {
    id: 1,
    company_code: "ABC-001",
    bill_number: "BILL-1234",
    collected_at: "2025-08-22T02:57:38.014Z",
    amount_collected: "3000",
    method: "Cash",
    status: "pending",
    executive_id: 1,
    comments: "Paid in cash at site. All good.",
    next_promise_date: "2025-08-27",
    exec_location_verified: true
  },
  {
    id: 2,
    company_code: "HEL-002",
    bill_number: "BILL-5762",
    collected_at: "2025-08-21T17:41:12.222Z",
    amount_collected: "2500",
    method: "UPI",
    status: "pending",
    executive_id: 2,
    comments: "Part payment, exec promised next installment.",
    next_promise_date: "2025-08-30",
    exec_location_verified: false
  }
];

export default function AccountantApprovalScreen() {
  const [search, setSearch] = useState("");
  const [approvalItems, setApprovalItems] = useState(mockApprovalItems);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalAction, setModalAction] = useState(null); // "approve" or "reject"
  const [modalItem, setModalItem] = useState(null);
  const [modalComment, setModalComment] = useState("");

  // Search filter
  const filteredItems = approvalItems.filter(item =>
    item.company_code.toLowerCase().includes(search.toLowerCase()) ||
    (executiveNames[item.executive_id] || "").toLowerCase().includes(search.toLowerCase())
  );

  // Refresh handler (replace with your API call)
  const handleRefresh = () => {
    // You could re-fetch here
    setApprovalItems([...mockApprovalItems]);
  };

  const handleApprove = (item) => {
    setModalAction("approve");
    setModalItem(item);
    setModalComment("");
    setModalVisible(true);
  };

  const handleReject = (item) => {
    setModalAction("reject");
    setModalItem(item);
    setModalComment("");
    setModalVisible(true);
  };

  const handleModalSubmit = () => {
    setModalVisible(false);
    alert(`${modalAction === "approve" ? "Approved" : "Rejected"} payment ID ${modalItem.id} with comment: ${modalComment}`);
    // Integrate your API logic here
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.company}>{item.company_code}</Text>
        <Text style={styles.billno}>Bill: {item.bill_number ? item.bill_number : "#" + item.id}</Text>
        <Text style={styles.date}>{(new Date(item.collected_at)).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.executive}>Executive: <Text style={{ fontWeight: 'bold' }}>{executiveNames[item.executive_id] || item.executive_id}</Text></Text>
      <Text style={styles.info}>Method: <Text style={styles.infoValue}>{item.method}</Text></Text>
      <Text style={styles.info}>Next Promise Date: <Text style={styles.infoValue}>{item.next_promise_date}</Text></Text>
      <TouchableOpacity
        style={styles.commentsDropdown}
        onPress={() => setExpandedIdx(expandedIdx === index ? null : index)}
        activeOpacity={0.7}
      >
        <Text style={styles.commentLabel}>
          Comments <Ionicons name={expandedIdx === index ? "chevron-up" : "chevron-down"} size={16} color="#1f75fe" />
        </Text>
        {expandedIdx === index && (
          <View style={styles.commentBox}>
            <Text style={styles.commentText}>{item.comments || "No comments"}</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.amountRow}>
        <Text style={styles.amount}>₹{item.amount_collected}</Text>

        <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>

      </View>
    </View>

  );

  return (
    <View style={styles.container}>
      {/* Search by Name and Refresh */}
      <View style={styles.topRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Name"
          placeholderTextColor="#b2b2b2"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color="#215087" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No approvals found.</Text>}
        contentContainerStyle={{ paddingBottom: 30 }}
      />

      {/* Modal for approve/reject with comment box */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {modalAction === "approve" ? "Approve Payment" : "Reject Payment"}
            </Text>
            <Text style={styles.modalSub}>
              {modalItem ? `Company: ${modalItem.company_code}, Amount: ₹${modalItem.amount_collected}` : ""}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={modalComment}
              onChangeText={setModalComment}
              placeholder="Add a comment..."
              multiline
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleModalSubmit}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Submit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color="#e25757" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafd",
    padding: 16
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    borderColor: "#b2d9e8",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 16,
    marginRight: 10
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: "#e8f2fc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#b4dcea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.11,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e6f2fb"
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5
  },
  company: {
    fontSize: 15,
    fontWeight: "700",
    color: "#215087"
  },
  billno: {
    fontSize: 13,
    color: "#3d7ca6"
  },
  date: {
    fontSize: 13,
    color: "#888"
  },
  executive: {
    fontSize: 14,
    marginBottom: 4,
    color: "#184977"
  },
  info: {
    fontSize: 13,
    color: "#444",
    marginBottom: 2
  },
  infoValue: {
    color: "#2279d2",
    fontWeight: "600"
  },
  commentsDropdown: {
    borderWidth: 1,
    borderColor: "#deebf7",
    borderRadius: 10,
    backgroundColor: "#f1f9ff",
    marginTop: 7,
    marginBottom: 3,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  commentLabel: {
    color: "#215087",
    fontWeight: "600",
    fontSize: 14
  },
  commentBox: {
    marginTop: 7,
    padding: 6,
    backgroundColor: "#e7f4fd",
    borderRadius: 6
  },
  commentText: {
    fontSize: 13,
    color: "#1c4064"
  },
  amountRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end"
  },
  amount: {
    fontSize: 22,
    fontWeight: "700",
    color: "#189A7D",
    marginRight: 12,
    marginLeft: "auto"
  },
  actionBtn: {
    marginLeft: 7
  },
  empty: {
    color: "#8e99b6",
    fontSize: 16,
    textAlign: "center",
    marginTop: 35
  },
  approveBtn: {
    width: 64,
    height: 32,
    backgroundColor: "#1aa37a",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
  rejectBtn: {
    width: 64,
    height: 32,
    backgroundColor: "#e25656",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,20,40,0.18)",
    justifyContent: "center",
    alignItems: "center"
  },
  modalBox: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    position: "relative"
  },
  modalTitle: {
    fontWeight: "800",
    fontSize: 17,
    color: "#184977",
    marginBottom: 4
  },
  modalSub: {
    fontSize: 15,
    color: "#215087",
    marginBottom: 12
  },
  modalInput: {
    borderColor: "#b2d9e8",
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#f8fafd",
    padding: 14,
    fontSize: 16,
    color: "#184977",
    width: "100%",
    height: 90,
    marginBottom: 18
  },
  submitBtn: {
    backgroundColor: "#1f75fe",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 35,
    alignItems: "center",
    marginBottom: 6
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12
  },
});
